import { log } from '../core/logger.js';
import { cache } from '../cache/instance.js';
import { cacheKey } from '../cache/cacheWire.js';

export interface PrefetchOptions {
  url: string;
}

const PREFETCHED = new WeakSet<Element>();

export function applyPrefetch(element: Element, options: PrefetchOptions): boolean {
  // Only bind once per element
  const marker = 'data-flux-prefetch-bound';
  if (element.hasAttribute(marker)) return false;
  element.setAttribute(marker, '1');

  const url = options.url || element.getAttribute('fx-get') || element.getAttribute('hx-get');
  if (!url) return false;

  const onTrigger = () => {
    if (PREFETCHED.has(element)) return;
    PREFETCHED.add(element);

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
        if (!res.ok) return;
        const text = await res.text();
        cache.set(key, text);
        log.info(`[flux] Prefetched and cached: ${url}`);
      })
      .catch((err) => {
        log.warn(`[flux] Prefetch failed for ${url}:`, err);
      });
  };

  element.addEventListener('mouseenter', onTrigger, { once: true });
  element.addEventListener('touchstart', onTrigger, { once: true, passive: true });
  element.addEventListener('focusin', onTrigger, { once: true });

  return true;
}
