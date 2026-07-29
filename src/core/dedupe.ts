// Concurrent Request Deduplication. Coalesces duplicate in-flight GET requests to the same URL into a single network call.

import { getRequestContext } from './events.js';

interface PendingConsumer {
  element: Element;
  target?: Element | null;
  swap?: string;
}

const inFlightRequests = new Map<string, PendingConsumer[]>();

function readHeader(headers: unknown, name: string): string | null {
  if (!headers) return null;
  if (typeof (headers as any).get === 'function') {
    return (headers as any).get(name) ?? (headers as any).get(name.toLowerCase()) ?? null;
  }
  if (typeof headers === 'object') {
    const record = headers as Record<string, unknown>;
    for (const [k, v] of Object.entries(record)) {
      if (k.toLowerCase() === name.toLowerCase() && v !== undefined && v !== null) {
        return String(v);
      }
    }
  }
  return null;
}

function hasAuthorizationHeader(headers: unknown): boolean {
  return Boolean(readHeader(headers, 'authorization'));
}

/** Installs the request deduplication hook. */
export function installDeduplication(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onRequest = (evt: Event) => {
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
    const consumers = inFlightRequests.get(key);

    if (consumers) {
      // In-flight request exists: register as duplicate consumer and set dedupe hit flag
      if (ctx.ctx) {
        ctx.ctx.isDedupeHit = true;
      }
      consumers.push({
        element,
        target: ctx.target,
        swap: element.getAttribute('hx-swap') ?? element.getAttribute('fx-swap') ?? undefined,
      });
      ctx.request?.abort?.();
    } else {
      // First request: initialize consumer queue
      inFlightRequests.set(key, [{ element, target: ctx.target }]);
    }
  };

  const onResponse = (evt: Event) => {
    const ctx = getRequestContext(evt);

    // Follower early return guard: aborted deduplication followers must NOT delete the leader's in-flight request group!
    if (ctx.isDedupeHit || (ctx as any).ctx?.isDedupeHit) return;

    const method = (ctx.request?.method ?? 'GET').toUpperCase();
    if (method !== 'GET') return;

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
    const consumers = inFlightRequests.get(key);
    if (!consumers) return;

    inFlightRequests.delete(key);

    if (ctx.successful && ctx.text !== null && ctx.text !== undefined) {
      const activeHtmx = (window as any).htmx ?? (globalThis as any).htmx;
      // Share response payload with secondary consumers (handles empty "" string responses cleanly)
      for (let i = 1; i < consumers.length; i++) {
        const consumer = consumers[i];
        if (consumer && consumer.target && typeof activeHtmx?.swap === 'function') {
          activeHtmx.swap({
            target: consumer.target,
            text: ctx.text,
            swap: consumer.swap ?? 'innerHTML',
          });
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
