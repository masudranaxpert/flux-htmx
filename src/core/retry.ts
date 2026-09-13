// Automatic Retry & Exponential Backoff capability for network/HTTP failures (502, 503, 504, network errors).

import { log } from './logger.js';
import { getRequestContext } from './events.js';
import { readHeader, withHeaders } from './headers.js';

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffFactor: number;
  allowUnsafe: boolean;
}

const retryingElements = new WeakMap<Element, number>();
const activeRetryTimers = new Map<Element, Set<NodeJS.Timeout>>();

export function cancelElementRetryTimers(element: Element): void {
  const timers = activeRetryTimers.get(element);
  if (timers) {
    for (const timerId of timers) {
      clearTimeout(timerId);
    }
    activeRetryTimers.delete(element);
  }
}

/** Parses retry options declared on `element`. */
export function getRetryOptions(element: Element): RetryOptions | null {
  const retryAttr = element.getAttribute('fx-retry');
  if (!retryAttr || retryAttr === 'false') return null;

  const maxRetries = Number(retryAttr);
  if (!Number.isFinite(maxRetries) || maxRetries <= 0) return null;

  const delayStr = element.getAttribute('fx-retry-delay') ?? '500ms';
  const delayMs = parseDelayMs(delayStr);

  const backoffStr = element.getAttribute('fx-retry-backoff') ?? '2';
  const backoffFactor = Number(backoffStr);

  const allowUnsafe = element.getAttribute('fx-retry-safe') === 'true';

  return {
    maxRetries,
    delayMs: Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 500,
    backoffFactor: Number.isFinite(backoffFactor) && backoffFactor >= 1 ? backoffFactor : 2,
    allowUnsafe,
  };
}

function parseDelayMs(val: string): number {
  const normalized = val.trim();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const match = /^(\d+)(ms|s|m)?$/.exec(normalized);
  if (!match) return 500;
  const num = Number(match[1]);
  const unit = match[2] ?? 'ms';
  return num * (unit === 'ms' ? 1 : unit === 's' ? 1000 : 60000);
}

/** Installs the global retry listener for network errors and 50x responses. */
export function installRetrySupport(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onRequest = (evt: Event) => {
    const ctx = getRequestContext(evt);
    if (ctx.source && ctx.request) {
      // Cancel pending retry timers when a fresh request is initiated
      cancelElementRetryTimers(ctx.source);

      const isRetry = readHeader(ctx.request.headers, 'X-Flux-Retry') === 'true';
      if (!isRetry) {
        retryingElements.delete(ctx.source);
      }
    }
  };

  const onCleanup = (evt: Event) => {
    const elt = (evt as CustomEvent).detail?.ctx?.targetElement ?? evt.target;
    if (elt instanceof Element) {
      for (const [timerElt, timers] of activeRetryTimers.entries()) {
        if (elt === timerElt || elt.contains(timerElt)) {
          for (const timerId of timers) clearTimeout(timerId);
          activeRetryTimers.delete(timerElt);
          retryingElements.delete(timerElt);
        } else if (!timerElt.isConnected) {
          // Element left the DOM without an htmx cleanup (fx-remove, sugar remove):
          // drop its pending timers so the Map cannot accumulate detached entries.
          for (const timerId of timers) clearTimeout(timerId);
          activeRetryTimers.delete(timerElt);
          retryingElements.delete(timerElt);
        }
      }
    }
  };

  const onResponse = (evt: Event) => {
    const ctx = getRequestContext(evt);
    const element = ctx.source;
    if (!element) return;
    delete ctx.ctx.retryPending;
    delete ctx.ctx.retryTerminal;

    // Retry skip guard: skip retries for cache hits, dedupe hits, and user aborts
    if (
      ctx.isCacheHit ||
      ctx.isDedupeHit ||
      (ctx.ctx as any)?.isCacheHit ||
      (ctx.ctx as any)?.isDedupeHit ||
      (ctx.ctx as any)?.aborted
    ) {
      cancelElementRetryTimers(element);
      ctx.ctx.retryTerminal = true;
      return;
    }

    const opts = getRetryOptions(element);
    if (!opts) {
      ctx.ctx.retryTerminal = true;
      return;
    }

    const method = (ctx.request?.method ?? 'GET').toUpperCase();
    const isSafe = method === 'GET' || method === 'HEAD' || opts.allowUnsafe;
    if (!isSafe) {
      ctx.ctx.retryTerminal = true;
      return;
    }

    const isRetryableError =
      !ctx.successful &&
      (ctx.status === 0 || ctx.status === 502 || ctx.status === 503 || ctx.status === 504);

    if (!isRetryableError) {
      retryingElements.delete(element);
      cancelElementRetryTimers(element);
      ctx.ctx.retryTerminal = true;
      return;
    }

    const currentAttempt = retryingElements.get(element) ?? 0;
    if (currentAttempt >= opts.maxRetries) {
      log.warn(`[flux] max retries (${opts.maxRetries}) reached for element:`, element);
      retryingElements.delete(element);
      cancelElementRetryTimers(element);
      ctx.ctx.retryTerminal = true;
      return;
    }

    const nextAttempt = currentAttempt + 1;
    retryingElements.set(element, nextAttempt);
    ctx.ctx.retryPending = true;

    const backoffDelay = Math.round(opts.delayMs * Math.pow(opts.backoffFactor, currentAttempt));
    log.info(`[flux] scheduling retry ${nextAttempt}/${opts.maxRetries} in ${backoffDelay}ms`);

    element.dispatchEvent(
      new CustomEvent('flux:retry', {
        bubbles: true,
        detail: { attempt: nextAttempt, maxRetries: opts.maxRetries, delayMs: backoffDelay },
      }),
    );

    const actionUrl =
      ctx.request?.action ??
      element.getAttribute('hx-get') ??
      element.getAttribute('hx-post') ??
      element.getAttribute('fx-get') ??
      element.getAttribute('fx-post');

    const requestParams = ctx.request?.parameters;
    const requestHeaders = ctx.request?.headers;
    const requestTarget = ctx.target ?? element;

    cancelElementRetryTimers(element);

    const timerId = setTimeout(() => {
      const timers = activeRetryTimers.get(element);
      timers?.delete(timerId);
      if (timers?.size === 0) activeRetryTimers.delete(element);

      const activeHtmx = (window as any).htmx ?? (globalThis as any).htmx;

      if (typeof activeHtmx?.ajax === 'function' && actionUrl) {
        activeHtmx.ajax(method, actionUrl, {
          source: element,
          target: requestTarget,
          swap: element.getAttribute('hx-swap') ?? element.getAttribute('fx-swap') ?? 'innerHTML',
          values: requestParams,
          // headers may be a Headers instance or a plain record; withHeaders preserves
          // every existing header (CSRF, auth) either way.
          headers: withHeaders(requestHeaders, { 'X-Flux-Retry': 'true' }),
        });
      } else {
        // Never fall back to element.click() / trigger('click'): a re-click replays
        // hx-confirm dialogs and re-runs native htmx triggers with unexpected semantics.
        // Skipping (with a warning) is the safe last resort.
        log.warn(`[flux] retry skipped — htmx.ajax unavailable:`, element);
      }
    }, backoffDelay);

    const elementTimers = activeRetryTimers.get(element) ?? new Set();
    elementTimers.add(timerId);
    activeRetryTimers.set(element, elementTimers);
  };

  document.addEventListener('htmx:before:request', onRequest);
  document.addEventListener('htmx:after:request', onResponse);
  document.addEventListener('htmx:before:cleanup', onCleanup);
  return () => {
    document.removeEventListener('htmx:before:request', onRequest);
    document.removeEventListener('htmx:after:request', onResponse);
    document.removeEventListener('htmx:before:cleanup', onCleanup);
    disposeRetrySupport();
  };
}

export function disposeRetrySupport(): void {
  for (const timers of Array.from(activeRetryTimers.values())) {
    for (const id of Array.from(timers)) {
      clearTimeout(id);
    }
  }
  activeRetryTimers.clear();
}
