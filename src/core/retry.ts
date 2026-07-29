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
const activeRetryTimers = new Set<NodeJS.Timeout>();

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

  const onResponse = (evt: Event) => {
    const ctx = getRequestContext(evt);
    const element = ctx.source;
    if (!element) return;

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
      return;
    }

    const currentAttempt = retryingElements.get(element) ?? 0;
    if (currentAttempt >= opts.maxRetries) {
      log.warn(`[flux] max retries (${opts.maxRetries}) reached for element:`, element);
      retryingElements.delete(element);
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

    const timerId = setTimeout(() => {
      activeRetryTimers.delete(timerId);
      const activeHtmx = (window as any).htmx ?? (globalThis as any).htmx;
      const actionUrl =
        ctx.request?.action ??
        element.getAttribute('hx-get') ??
        element.getAttribute('hx-post') ??
        element.getAttribute('fx-get') ??
        element.getAttribute('fx-post');

      if (typeof activeHtmx?.ajax === 'function' && actionUrl) {
        activeHtmx.ajax(method, actionUrl, element);
      } else if (typeof activeHtmx?.trigger === 'function') {
        activeHtmx.trigger(element, 'click');
      } else if (element instanceof HTMLElement && typeof element.click === 'function') {
        element.click();
      }
    }, backoffDelay);

    activeRetryTimers.add(timerId);
  };

  document.addEventListener('htmx:after:request', onResponse);
  return () => {
    document.removeEventListener('htmx:after:request', onResponse);
    disposeRetrySupport();
  };
}

export function disposeRetrySupport(): void {
  for (const id of Array.from(activeRetryTimers)) {
    clearTimeout(id);
  }
  activeRetryTimers.clear();
}
