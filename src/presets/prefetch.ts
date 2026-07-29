import { log } from '../core/logger.js';
import { cache } from '../cache/instance.js';
import { cacheKey, canStoreResponse, getCachePolicy } from '../cache/cacheWire.js';

export interface PrefetchOptions {
  url: string;
}

let PREFETCHED = new WeakSet<Element>();
const prefetchControllers = new WeakMap<Element, { signature: string; cleanup: () => void }>();

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

    const key = cacheKey(element, { method: 'GET', action: url });
    const existing = cache.get(key, { allowStale: true, returnMeta: true });
    if (existing) return;

    fetch(url, {
      method: 'GET',
      headers: {
        'HX-Request': 'true',
        'X-Flux-Prefetch': 'true',
      },
    })
      .then(async (res) => {
        if (!canStoreResponse({ method: 'GET' }, res)) return;
        const text = await res.text();

        cache.set(key, text, policy.ttl ?? 60000); // Default to 60s if no policy
        log.info(`[flux] Prefetched and cached: ${url}`);
      })
      .catch((err) => {
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
