// Concurrent Request Deduplication. Coalesces duplicate in-flight GET requests to the same
// URL into a single network call. Every in-flight group carries a deadline: if the leader
// never completes (page hide, exception, dropped htmx event), the key is released so later
// requests are not stuck as aborted followers forever.

import { getRequestContext } from './events.js';
import { readHeader } from './headers.js';
import { resolveHtmx } from './startup.js';

interface PendingConsumer {
  element: Element;
  target?: Element | null;
  swap?: string;
}
const inFlightRequests = new Map<string, { consumers: PendingConsumer[]; armedAt: number }>();

/** How long a leader may hold the in-flight key without completing. */
const IN_FLIGHT_DEADLINE_MS = 30_000;

/**
 * Releases keys whose leader never finished (page hide, exception, dropped htmx event).
 * Checked lazily on each new request: the key cannot block dedupe beyond the deadline,
 * and no timer is kept alive for it.
 */
function purgeExpiredInFlight(): void {
  const now = Date.now();
  for (const [key, entry] of inFlightRequests) {
    if (now - entry.armedAt > IN_FLIGHT_DEADLINE_MS) inFlightRequests.delete(key);
  }
}

/** Installs the request deduplication hook. */
export function installDeduplication(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onRequest = (evt: Event) => {
    purgeExpiredInFlight();
    const ctx = getRequestContext(evt);
    const element = ctx.source;
    if (!element) return;

    // Explicit opt-in guard: only deduplicate when fx-dedupe="true" is declared
    const dedupeAttr = element.getAttribute('fx-dedupe');
    if (!dedupeAttr || dedupeAttr === 'false') return;

    const method = (ctx.request?.method ?? 'GET').toUpperCase();
    if (method !== 'GET') return;

    if (hasAuthorizationHeader(ctx.request?.headers)) return;

    const url =
      ctx.request?.action ?? element.getAttribute('hx-get') ?? element.getAttribute('fx-get');
    if (!url) return;

    const key = computeDedupeKey(
      element,
      method,
      url,
      ctx.request?.parameters,
      ctx.request?.headers,
    );
    const entry = inFlightRequests.get(key);

    const isRetry = readHeader(ctx.request?.headers, 'X-Flux-Retry') === 'true';

    if (entry) {
      if (isRetry) {
        // Retry request takes over as the new leader; followers stay queued and the
        // deadline restarts with the retry attempt.
        entry.consumers[0] = {
          element,
          target: ctx.target,
          swap: element.getAttribute('hx-swap') ?? element.getAttribute('fx-swap') ?? undefined,
        };
        entry.armedAt = Date.now();
        return;
      }
      // In-flight request exists: register as duplicate consumer and set dedupe hit flag
      if (ctx.ctx) {
        ctx.ctx.isDedupeHit = true;
      }
      entry.consumers.push({
        element,
        target: ctx.target,
        swap: element.getAttribute('hx-swap') ?? element.getAttribute('fx-swap') ?? undefined,
      });
      ctx.request?.abort?.();
    } else {
      // First request: initialize consumer queue with a completion deadline.
      inFlightRequests.set(key, {
        consumers: [{ element, target: ctx.target }],
        armedAt: Date.now(),
      });
    }
  };

  const onResponse = (evt: Event) => {
    const ctx = getRequestContext(evt);

    // Follower early return guard: aborted deduplication followers must NOT delete the leader's in-flight request group!
    if (ctx.isDedupeHit || (ctx as { ctx?: { isDedupeHit?: boolean } }).ctx?.isDedupeHit) return;

    const method = (ctx.request?.method ?? 'GET').toUpperCase();
    if (method !== 'GET') return;
    if (ctx.isDedupeHit || ctx.ctx?.isDedupeHit) return;
    const url =
      ctx.request?.action ??
      ctx.source?.getAttribute('hx-get') ??
      ctx.source?.getAttribute('fx-get');
    if (!url) return;

    const key = computeDedupeKey(
      ctx.source ?? document.body,
      method,
      url,
      ctx.request?.parameters,
      ctx.request?.headers,
    );
    const group = inFlightRequests.get(key)?.consumers;
    if (!group) return;

    if (!ctx.successful) {
      // Keep followers suspended only when retry support actually scheduled another attempt.
      if (ctx.ctx.retryPending === true) return;
    }

    inFlightRequests.delete(key);

    const activeHtmx = resolveHtmx();

    if (ctx.successful && ctx.text !== null && ctx.text !== undefined) {
      // Share response payload & fire follower lifecycle events for secondary consumers
      for (let i = 1; i < group.length; i++) {
        const consumer = group[i];
        if (consumer && consumer.target && typeof activeHtmx?.swap === 'function') {
          activeHtmx.swap({
            target: consumer.target,
            text: ctx.text,
            swap: consumer.swap ?? 'innerHTML',
          });

          consumer.element.dispatchEvent(
            new CustomEvent('htmx:after:swap', {
              bubbles: true,
              detail: {
                elt: consumer.element,
                target: consumer.target,
                xhr: ctx.detail.xhr,
                response: ctx.text,
              },
            }),
          );

          consumer.element.dispatchEvent(
            new CustomEvent('flux:dedupe:success', {
              bubbles: true,
              detail: { element: consumer.element, target: consumer.target, text: ctx.text },
            }),
          );
        }
      }
    } else if (!ctx.successful) {
      // Leader failure: propagate error lifecycle events to secondary followers
      for (let i = 1; i < group.length; i++) {
        const consumer = group[i];
        if (consumer && consumer.element) {
          consumer.element.dispatchEvent(
            new CustomEvent('flux:dedupe:error', {
              bubbles: true,
              detail: { element: consumer.element, status: ctx.status, text: ctx.text },
            }),
          );
          consumer.element.dispatchEvent(
            new CustomEvent('htmx:response:error', {
              bubbles: true,
              detail: {
                ctx: {
                  ...ctx.ctx,
                  sourceElement: consumer.element,
                  target: consumer.target,
                  response: ctx.ctx.response ?? {
                    status: ctx.status,
                    headers: ctx.detail.xhr?.headers,
                  },
                  text: ctx.text,
                },
              },
            }),
          );
        }
      }
    }
  };

  document.addEventListener('htmx:config:request', onRequest);
  document.addEventListener('htmx:after:request', onResponse);

  return () => {
    document.removeEventListener('htmx:config:request', onRequest);
    document.removeEventListener('htmx:after:request', onResponse);
    inFlightRequests.clear();
  };
}

function hasAuthorizationHeader(headers: unknown): boolean {
  return Boolean(readHeader(headers, 'authorization'));
}

function computeDedupeKey(
  source: Element,
  method: string,
  url: string,
  params?: Record<string, unknown>,
  headers?: unknown,
): string {
  const searchParams = new URLSearchParams();

  if (url.includes('?')) {
    const qIndex = url.indexOf('?');
    const existingParams = new URLSearchParams(url.slice(qIndex + 1));
    for (const [k, v] of existingParams.entries()) {
      searchParams.append(k, v);
    }
  }

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        searchParams.delete(k);
        if (Array.isArray(v)) {
          for (let i = 0; i < v.length; i++) {
            searchParams.append(`${k}[${i}]`, String(v[i]));
          }
        } else {
          searchParams.append(k, String(v));
        }
      }
    }
  }

  const sortedEntries = Array.from(searchParams.entries()).sort(
    ([aK, aV], [bK, bV]) => aK.localeCompare(bK) || aV.localeCompare(bV),
  );

  const canonicalParams = new URLSearchParams();
  for (const [k, v] of sortedEntries) {
    canonicalParams.append(k, v);
  }

  // Handle fx-dedupe-vary header key inclusion with case-insensitive lookup
  const varyAttr = source.getAttribute('fx-dedupe-vary');
  let headerVaryStr = '';
  if (varyAttr && headers) {
    const varyTokens = varyAttr.split(',').map((s) => s.trim().toLowerCase());
    const headerParts: string[] = [];
    for (const token of varyTokens) {
      const val = readHeader(headers, token);
      if (val) headerParts.push(`${token}=${val}`);
    }
    headerVaryStr = headerParts.join(';');
  }

  const basePath = url.split('?')[0] ?? url;
  const qStr = canonicalParams.toString();
  return `${method}:${basePath}${qStr ? `?${qStr}` : ''}${headerVaryStr ? `#${headerVaryStr}` : ''}`;
}
