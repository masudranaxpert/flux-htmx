import { log } from '../core/logger.js';
import { cache } from '../cache/instance.js';
import { cacheKey, getCachePolicy } from '../cache/cacheWire.js';

export interface PrefetchOptions {
  url: string;
}

let PREFETCHED = new WeakSet<Element>();

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
        if (!res.ok) return;
        const text = await res.text();
        
        // Also check response headers for no-store
        const cacheControl = (res.headers.get('Cache-Control') ?? '').toLowerCase();
        if (cacheControl.includes('no-store') || cacheControl.includes('no-cache')) return;
        
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

  return true;
}

export function disconnectPrefetch(element: Element): void {
  element.removeAttribute('data-flux-prefetch-bound');
  PREFETCHED.delete(element);
}

export function disposePrefetchControllers(): void {
  if (typeof document !== 'undefined') {
    for (const el of Array.from(document.querySelectorAll('[data-flux-prefetch-bound]'))) {
      el.removeAttribute('data-flux-prefetch-bound');
    }
  }
  PREFETCHED = new WeakSet();
}
