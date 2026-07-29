// Automatic Retry & Exponential Backoff capability for network/HTTP failures (502, 503, 504, network errors).

import { log } from './logger.js';
import { getRequestContext } from './events.js';

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
    const elt = (evt as CustomEvent).detail?.elt ?? evt.target;
    if (elt instanceof Element) {
      for (const [timerElt, timers] of activeRetryTimers.entries()) {
        if (elt === timerElt || elt.contains(timerElt)) {
          for (const timerId of timers) clearTimeout(timerId);
          activeRetryTimers.delete(timerElt);
          retryingElements.delete(timerElt);
        }
      }
    }
  };

  function readHeader(headers: unknown, name: string): string | null {
    if (!headers) return null;
    if (typeof (headers as any).get === 'function') {
      return (headers as any).get(name) ?? (headers as any).get(name.toLowerCase()) ?? null;
    }
    if (typeof headers === 'object') {
      for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
        if (k.toLowerCase() === name.toLowerCase() && v !== undefined && v !== null) {
          return String(v);
        }
      }
    }
    return null;
  }

  const onResponse = (evt: Event) => {
    const ctx = getRequestContext(evt);
    const element = ctx.source;
    if (!element) return;

    // Retry skip guard: skip retries for cache hits, dedupe hits, and user aborts
    if (
      ctx.isCacheHit ||
      ctx.isDedupeHit ||
      (ctx.ctx as any)?.isCacheHit ||
      (ctx.ctx as any)?.isDedupeHit ||
      (ctx.ctx as any)?.aborted
    ) {
      cancelElementRetryTimers(element);
      return;
    }

    const opts = getRetryOptions(element);
    if (!opts) return;

    const method = (ctx.request?.method ?? 'GET').toUpperCase();
    const isSafe = method === 'GET' || method === 'HEAD' || opts.allowUnsafe;
    if (!isSafe) return;

    const isRetryableError =
      !ctx.successful &&
      (ctx.status === 0 || ctx.status === 502 || ctx.status === 503 || ctx.status === 504);

    if (!isRetryableError) {
      retryingElements.delete(element);
      cancelElementRetryTimers(element);
      return;
    }

    const currentAttempt = retryingElements.get(element) ?? 0;
    if (currentAttempt >= opts.maxRetries) {
      log.warn(`[flux] max retries (${opts.maxRetries}) reached for element:`, element);
      retryingElements.delete(element);
      cancelElementRetryTimers(element);
      return;
    }

    const nextAttempt = currentAttempt + 1;
    retryingElements.set(element, nextAttempt);

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
          headers: { ...(requestHeaders as Record<string, string>), 'X-Flux-Retry': 'true' },
        });
      } else if (typeof activeHtmx?.trigger === 'function') {
        activeHtmx.trigger(element, 'click');
      } else if (element instanceof HTMLElement && typeof element.click === 'function') {
        element.click();
      }
    }, backoffDelay);

    const elementTimers = activeRetryTimers.get(element) ?? new Set();
    elementTimers.add(timerId);
    activeRetryTimers.set(element, elementTimers);
  };

  document.addEventListener('htmx:before:request', onRequest);
  document.addEventListener('htmx:after:request', onResponse);
  document.addEventListener('htmx:beforeCleanupElement', onCleanup);
  return () => {
    document.removeEventListener('htmx:before:request', onRequest);
    document.removeEventListener('htmx:after:request', onResponse);
    document.removeEventListener('htmx:beforeCleanupElement', onCleanup);
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
