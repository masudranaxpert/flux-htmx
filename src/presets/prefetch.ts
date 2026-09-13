import { log } from '../core/logger.js';
import { cache } from '../cache/instance.js';
import { cacheKey, canStoreResponse, getCachePolicy } from '../cache/cacheWire.js';
import { runtimeConfig } from '../core/runtime.js';
import { resolveToken, shouldAttach } from '../core/csrf.js';

export interface PrefetchOptions {
  url: string;
}

let PREFETCHED = new WeakSet<Element>();
const prefetchControllers = new WeakMap<Element, { signature: string; cleanup: () => void }>();

/**
 * Approximates the parameters htmx would send for this element, so the prefetch cache
 * key matches the key a real request computes (which includes ctx.request.parameters).
 */
function prefetchParameters(element: Element): Record<string, unknown> {
  const vals = element.getAttribute('hx-vals');
  if (vals) {
    try {
      const parsed: unknown = JSON.parse(vals);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // js:/css: expressions or malformed JSON — fall through to form/empty params.
    }
  }
  if (element instanceof HTMLFormElement) {
    const params: Record<string, unknown> = {};
    try {
      for (const [k, v] of Array.from(new FormData(element).entries())) {
        if (typeof v === 'string') params[k] = v;
      }
    } catch {
      // Detached form edge case — params stay empty.
    }
    return params;
  }
  return {};
}

/** Builds the headers a real htmx request would carry (plus the prefetch marker). */
function prefetchHeaders(element: Element): Record<string, string> {
  const headers: Record<string, string> = {
    'HX-Request': 'true',
    'HX-Current-URL': typeof location !== 'undefined' ? location.href : '',
    'X-Flux-Prefetch': 'true',
  };
  const target = element.getAttribute('hx-target') ?? element.getAttribute('fx-target');
  if (target) headers['HX-Target'] = target;
  const triggerName = element.id || element.getAttribute('name');
  if (triggerName) headers['HX-Trigger'] = triggerName;

  const cfg = runtimeConfig();
  if (cfg) {
    const token = resolveToken(cfg.csrf);
    if (shouldAttach('GET', element.getAttribute('hx-get') ?? '', token) && token.value) {
      headers[token.headerName] = token.value;
    }
  }
  return headers;
}

export function applyPrefetch(element: Element, options: PrefetchOptions): boolean {
  const marker = 'data-flux-prefetch-bound';
  const url = options.url || element.getAttribute('fx-get') || element.getAttribute('hx-get');
  if (!url) return false;
  const signature = [
    url,
    element.getAttribute('fx-cache') ?? '',
    element.getAttribute('fx-cache-mode') ?? '',
    element.getAttribute('fx-cache-key') ?? '',
  ].join('|');

  const existingController = prefetchControllers.get(element);
  if (existingController?.signature === signature) return false;
  existingController?.cleanup();

  element.setAttribute(marker, '1');
  element.setAttribute('data-flux-preset', 'prefetch');

  const onTrigger = () => {
    if (PREFETCHED.has(element)) return;
    PREFETCHED.add(element);

    const policy = getCachePolicy(element);
    if (element.getAttribute('fx-cache') === 'false') return;

    // Same key shape a real request produces, including parameters.
    const key = cacheKey(element, {
      method: 'GET',
      action: url,
      parameters: prefetchParameters(element),
    });
    const existing = cache.get(key, { allowStale: true, returnMeta: true });
    if (existing) return;

    const cfg = runtimeConfig();
    const timeoutMs = cfg?.requests.timeoutMs ?? 0;
    const signal =
      timeoutMs > 0 && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(timeoutMs)
        : undefined;

    fetch(url, {
      method: 'GET',
      credentials: cfg?.requests.credentials,
      signal,
      headers: prefetchHeaders(element),
    })
      .then(async (res) => {
        if (!canStoreResponse({ method: 'GET' }, res)) return;
        const text = await res.text();

        cache.set(key, text, policy.ttl ?? 60000); // Default to 60s if no policy
        log.info(`[flux] Prefetched and cached: ${url}`);
      })
      .catch((err: unknown) => {
        log.warn(`[flux] Prefetch failed for ${url}:`, err);
      });
  };

  element.addEventListener('mouseenter', onTrigger, { once: true });
  element.addEventListener('touchstart', onTrigger, { once: true, passive: true });
  element.addEventListener('focusin', onTrigger, { once: true });

  const cleanup = () => {
    element.removeEventListener('mouseenter', onTrigger);
    element.removeEventListener('touchstart', onTrigger);
    element.removeEventListener('focusin', onTrigger);
    element.removeAttribute(marker);
    PREFETCHED.delete(element);
    prefetchControllers.delete(element);
  };
  prefetchControllers.set(element, { signature, cleanup });

  return true;
}

export function disconnectPrefetch(element: Element): void {
  prefetchControllers.get(element)?.cleanup();
  element.removeAttribute('data-flux-preset');
  element.removeAttribute('data-flux-preset-signature');
}

export function disposePrefetchControllers(): void {
  if (typeof document !== 'undefined') {
    for (const element of document.querySelectorAll('[data-flux-prefetch-bound]')) {
      prefetchControllers.get(element)?.cleanup();
    }
  }
  PREFETCHED = new WeakSet();
}
