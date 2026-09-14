// fx-realtime preset — Server-Sent Events (SSE) consumer.
// Connects an element to an SSE endpoint; on each message HTMX swaps content into fx-target.
// No third-party deps. Native EventSource only.

import htmxImport from 'htmx.org';
import { resolveHtmx, type HtmxGlobal } from '../core/startup.js';
import { queryOne } from '../core/selectors.js';
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

  const resolveTarget = (): HTMLElement | null => {
    if (!options.target) return element;
    const found = queryOne(options.target);
    return found instanceof HTMLElement ? found : null;
  };

  if (options.target && !resolveTarget()) {
    log.warn(`fx-realtime: target "${options.target}" not found`);
    return false;
  }

  const swapStyle = options.swap ?? 'innerHTML';
  const eventName = options.event ?? 'message';

  const es = new EventSource(options.url, {
    withCredentials: options.withCredentials ?? false,
  });

  const activeHtmx = resolveHtmx(htmxImport as unknown as HtmxGlobal);

  const syncStatus = () => {
    const state = es.readyState === 0 ? 'connecting' : es.readyState === 1 ? 'open' : 'closed';
    element.setAttribute('data-flux-sse', state);
  };
  syncStatus();

  const onMessage = (evt: MessageEvent) => {
    const html = evt.data as string;
    if (!html) return;

    const currentTarget = resolveTarget();
    if (!currentTarget) {
      log.warn(`fx-realtime: target "${options.target}" not found`);
      return;
    }

    // Prefer htmx.swap for full HTMX lifecycle; fall back to direct innerHTML + process.
    if (typeof activeHtmx?.swap === 'function') {
      void activeHtmx.swap({
        target: currentTarget,
        text: html,
        swap: swapStyle,
        sourceElement: element,
      });
    } else {
      if (swapStyle === 'outerHTML') {
        currentTarget.outerHTML = html;
      } else {
        currentTarget.innerHTML = html;
      }
      activeHtmx?.process?.(currentTarget);
    }

    element.dispatchEvent(
      new CustomEvent('flux:realtime:message', {
        bubbles: true,
        detail: { url: options.url, data: html },
      }),
    );
  };

  const onError = () => {
    syncStatus();
    log.warn(`fx-realtime: SSE connection error on "${options.url}"`);
    element.dispatchEvent(
      new CustomEvent('flux:realtime:error', { bubbles: true, detail: { url: options.url } }),
    );
    if (es.readyState === 2) {
      element.dispatchEvent(
        new CustomEvent('flux:realtime:closed', { bubbles: true, detail: { url: options.url } }),
      );
    }
  };

  es.addEventListener('open', syncStatus);
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
    element.setAttribute('data-flux-sse', 'closed');
    log.info('fx-realtime: disconnected');
  }
}
