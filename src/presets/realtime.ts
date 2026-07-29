// fx-realtime preset — Server-Sent Events (SSE) consumer.
// Connects an element to an SSE endpoint; on each message HTMX swaps content into fx-target.
// No third-party deps. Native EventSource only.

import { log } from '../core/logger.js';

export interface RealtimeOptions {
  url: string;
  target?: string; // CSS selector; defaults to element itself
  swap?: string; // hx-swap value; defaults to "innerHTML"
  event?: string; // SSE event name to listen to; defaults to "message"
  withCredentials?: boolean;
}

// Active EventSource per element — allows clean dispose.
const realtimeControllers = new WeakMap<HTMLElement, EventSource>();

/**
 * Opens an SSE connection for `element`.
 * On each SSE message, swaps the received HTML into the target using htmx.swap (or innerHTML fallback).
 */
export function applyRealtime(element: Element, options: RealtimeOptions): boolean {
  if (!(element instanceof HTMLElement) || !options.url?.trim()) return false;

  if (typeof EventSource === 'undefined') {
    log.warn('fx-realtime: EventSource not supported in this environment');
    return false;
  }

  disconnectRealtime(element);

  const target = options.target
    ? (document.querySelector(options.target) as HTMLElement | null)
    : element;

  if (!target) {
    log.warn(`fx-realtime: target "${options.target}" not found`);
    return false;
  }

  const swapStyle = options.swap ?? 'innerHTML';
  const eventName = options.event ?? 'message';

  const es = new EventSource(options.url, {
    withCredentials: options.withCredentials ?? false,
  });

  const onMessage = (evt: MessageEvent) => {
    const html = evt.data as string;
    if (!html) return;

    // Prefer htmx.swap for full HTMX lifecycle; fall back to direct innerHTML.
    const htmx = (window as any).htmx;
    if (typeof htmx?.swap === 'function') {
      htmx.swap(target, html, { swapStyle });
    } else {
      if (swapStyle === 'outerHTML') {
        target.outerHTML = html;
      } else {
        target.innerHTML = html;
      }
    }

    element.dispatchEvent(
      new CustomEvent('flux:realtime:message', {
        bubbles: true,
        detail: { url: options.url, data: html },
      }),
    );
  };

  const onError = () => {
    log.warn(`fx-realtime: SSE connection error on "${options.url}"`);
    element.dispatchEvent(
      new CustomEvent('flux:realtime:error', { bubbles: true, detail: { url: options.url } }),
    );
  };

  es.addEventListener(eventName, onMessage as EventListener);
  es.addEventListener('error', onError);

  realtimeControllers.set(element, es);
  element.setAttribute('data-flux-preset', 'realtime');
  log.info(`fx-realtime: connected to "${options.url}" (event="${eventName}")`);

  return true;
}

export function disconnectRealtime(element: Element): void {
  if (!(element instanceof HTMLElement)) return;
  const es = realtimeControllers.get(element);
  if (es) {
    es.close();
    realtimeControllers.delete(element);
    log.info(`fx-realtime: disconnected`);
  }
}
