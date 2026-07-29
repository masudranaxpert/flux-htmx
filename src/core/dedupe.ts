// Concurrent Request Deduplication. Coalesces duplicate in-flight GET requests to the same URL into a single network call.

import { getRequestContext } from './events.js';

interface PendingConsumer {
  element: Element;
  target?: Element | null;
  swap?: string;
}

const inFlightRequests = new Map<string, PendingConsumer[]>();

/** Installs the request deduplication hook. */
export function installDeduplication(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onRequest = (evt: Event) => {
    const ctx = getRequestContext(evt);
    const element = ctx.source;
    if (!element) return;

    const dedupeAttr = element.getAttribute('fx-dedupe');
    if (dedupeAttr === 'false') return;

    const method = (ctx.request?.method ?? 'GET').toUpperCase();
    if (method !== 'GET') return;

    const url = ctx.request?.action ?? element.getAttribute('hx-get') ?? element.getAttribute('fx-get');
    if (!url) return;

    const key = `GET:${url}`;
    const consumers = inFlightRequests.get(key);

    if (consumers) {
      // In-flight request exists: register as duplicate consumer and abort duplicate network request
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
    const method = (ctx.request?.method ?? 'GET').toUpperCase();
    if (method !== 'GET') return;

    const url = ctx.request?.action ?? ctx.source?.getAttribute('hx-get') ?? ctx.source?.getAttribute('fx-get');
    if (!url) return;

    const key = `GET:${url}`;
    const consumers = inFlightRequests.get(key);
    if (!consumers) return;

    inFlightRequests.delete(key);

    if (ctx.successful && ctx.text) {
      const activeHtmx = (window as any).htmx ?? (globalThis as any).htmx;
      // Share response payload with secondary consumers
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
