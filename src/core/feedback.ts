// Visual feedback and accessible live region announcements.
//
// Automatically sets data-flux-loading on active request sources and toggles global
// indicators; sets data-flux-success / data-flux-error on completion; announces messages from
// fx-success / fx-error via aria-live. Also dispatches flux:toast events.

import type { ResolvedConfig } from './config.js';
import { log } from './logger.js';
import { safeQuerySelector } from './selectors.js';
import { getRequestContext } from './events.js';
import { setRequestState } from './request-state.js';

const LIVE_REGION_ID = 'flux-live-region';
const SUCCESS_ATTR = 'fx-success';
const ERROR_ATTR = 'fx-error';

let inFlight = 0;
let liveRegion: HTMLElement | null = null;
let teardown: (() => void) | null = null;
const activeElements = new Map<Element, number>();
const finishedContexts = new WeakSet<object>();

/**
 * Installs document-level event listeners for HTMX request lifecycle to provide visual
 * feedback and accessible announcements. Returns a teardown function.
 */
export function installFeedback(getConfig?: () => ResolvedConfig | null): () => void {
  if (typeof document === 'undefined') return () => {};

  const offlineTeardown = installOfflineTracking();

  const onStart = (evt: Event) => {
    const ctx = getRequestContext(evt);
    inFlight++;
    updateGlobalIndicator(true, getConfig);

    if (ctx.source) {
      const count = activeElements.get(ctx.source) ?? 0;
      activeElements.set(ctx.source, count + 1);
      setRequestState(ctx.source, 'loading');
    }
  };

  const onEnd = (evt: Event) => {
    const ctx = getRequestContext(evt);
    if (ctx.ctx) {
      if (finishedContexts.has(ctx.ctx)) return;
      finishedContexts.add(ctx.ctx);
    }

    inFlight = Math.max(0, inFlight - 1);
    if (inFlight === 0) updateGlobalIndicator(false, getConfig);

    if (ctx.source) {
      const count = activeElements.get(ctx.source) ?? 1;
      if (count <= 1) {
        activeElements.delete(ctx.source);
        ctx.source.removeAttribute('data-flux-loading');
      } else {
        activeElements.set(ctx.source, count - 1);
      }
    }
  };

  const onAfterRequest = (evt: Event) => {
    announceAndMarkResult(evt);
  };

  const onErrorEvent = (evt: Event) => {
    const ctx = getRequestContext(evt);
    if (ctx.isDedupeHit || ctx.isCacheHit || (ctx as any).ctx?.isDedupeHit || (ctx as any).ctx?.isCacheHit) return;
    if (ctx.source) {
      setRequestState(ctx.source, 'network-error');
      const message = ctx.source.getAttribute(ERROR_ATTR) ?? 'Request failed';
      announce(message);
    }
  };

  const onTimeoutEvent = (evt: Event) => {
    const ctx = getRequestContext(evt);
    if (ctx.isDedupeHit || ctx.isCacheHit || (ctx as any).ctx?.isDedupeHit || (ctx as any).ctx?.isCacheHit) return;
    if (ctx.source) {
      setRequestState(ctx.source, 'timeout');
    }
  };

  const onAbortEvent = (evt: Event) => {
    const ctx = getRequestContext(evt);
    if (ctx.isCacheHit || ctx.isDedupeHit || (ctx as any).isDedupeHit || ctx.ctx?.isDedupeHit || (ctx as any).ctx?.isCacheHit) return;
    if (ctx.source) {
      setRequestState(ctx.source, 'aborted');
    }
  };

  const onFinallyRequest = (evt: Event) => {
    onEnd(evt);
  };

  document.addEventListener('htmx:before:request', onStart);
  document.addEventListener('htmx:after:request', onAfterRequest);
  document.addEventListener('htmx:finally:request', onFinallyRequest);
  document.addEventListener('htmx:error', onErrorEvent);
  document.addEventListener('htmx:timeout', onTimeoutEvent);
  document.addEventListener('htmx:abort', onAbortEvent);

  teardown = () => {
    offlineTeardown();
    document.removeEventListener('htmx:before:request', onStart);
    document.removeEventListener('htmx:after:request', onAfterRequest);
    document.removeEventListener('htmx:finally:request', onFinallyRequest);
    document.removeEventListener('htmx:error', onErrorEvent);
    document.removeEventListener('htmx:timeout', onTimeoutEvent);
    document.removeEventListener('htmx:abort', onAbortEvent);
    inFlight = 0;
    updateGlobalIndicator(false, getConfig);
    for (const el of activeElements.keys()) {
      el.removeAttribute('data-flux-loading');
    }
    activeElements.clear();
  };

  return teardown;
}

/** Installs online/offline network status listeners. */
function installOfflineTracking(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onOffline = () => {
    document.body?.setAttribute('data-flux-offline', '1');
    announce('Network offline');
  };

  const onOnline = () => {
    document.body?.removeAttribute('data-flux-offline');
    announce('Network restored');
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine && document.body) {
    document.body.setAttribute('data-flux-offline', '1');
  }

  window.addEventListener('offline', onOffline);
  window.addEventListener('online', onOnline);

  return () => {
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('online', onOnline);
    document.body?.removeAttribute('data-flux-offline');
  };
}

function announceAndMarkResult(evt: Event): void {
  const ctx = getRequestContext(evt);
  if (!ctx.source || ctx.isDedupeHit || (ctx as any).ctx?.isDedupeHit) return;

  const isError = !ctx.successful;
  if (isError) {
    if (ctx.isCacheHit || (ctx as any).ctx?.isCacheHit) return;
    if (ctx.status === 0) {
      setRequestState(ctx.source, 'network-error');
    } else {
      setRequestState(ctx.source, 'http-error', ctx.status);
    }
  } else if (ctx.status >= 200 && ctx.status < 300) {
    setRequestState(ctx.source, 'success');
  }

  const type = isError ? 'error' : 'success';
  const message = isError
    ? ctx.source.getAttribute(ERROR_ATTR)
    : ctx.status >= 200 && ctx.status < 300
      ? ctx.source.getAttribute(SUCCESS_ATTR)
      : null;

  if (message) {
    announce(message);
    document.dispatchEvent(new CustomEvent('flux:toast', { detail: { message, type } }));
    if (ctx.source.hasAttribute('fx-toast') || document.body.hasAttribute('fx-toast')) {
      showBuiltInToast(message, type);
    }
  }
}

export function showBuiltInToast(message: string, type: 'success' | 'error'): void {
  let container = document.getElementById('flux-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'flux-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `flux-toast flux-toast-${type}`;
  toast.textContent = message;
  
  // Create close button (optional but good for UX)
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:1.2em;margin-left:auto;color:inherit;opacity:0.7;';
  closeBtn.onclick = () => removeToast(toast);
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  const timeoutId = setTimeout(() => {
    removeToast(toast);
  }, 3000);

  // Store timeout on element so it can be cleared if manually closed
  (toast as any)._timeoutId = timeoutId;
}

function removeToast(toast: HTMLElement): void {
  if (toast.classList.contains('flux-toast-leave')) return;
  if ((toast as any)._timeoutId) {
    clearTimeout((toast as any)._timeoutId);
  }
  toast.classList.add('flux-toast-leave');
  toast.addEventListener('animationend', () => {
    toast.remove();
  }, { once: true });
  setTimeout(() => toast.remove(), 300); // fallback if no animation
}

/** Toggles data-flux-active / .flux-active on global indicator element. */
function updateGlobalIndicator(active: boolean, getConfig?: () => ResolvedConfig | null): void {
  const selector = resolveIndicatorSelector(getConfig);
  if (!selector) return;

  const el = safeQuerySelector(selector);
  if (el) {
    el.toggleAttribute('data-flux-active', active);
    el.classList.toggle('flux-active', active);
  }
}

/** Resolves indicator selector from config then meta tag. */
function resolveIndicatorSelector(getConfig?: () => ResolvedConfig | null): string | null {
  const configIndicator = getConfig?.()?.feedback?.indicator;
  if (configIndicator) return configIndicator;

  const meta = document.querySelector('meta[name="flux-feedback"]');
  const content = meta?.getAttribute('content');
  if (!content) return null;

  try {
    const parsed = JSON.parse(content);
    return parsed.indicator ?? null;
  } catch (e) {
    log.url('invalid flux-feedback meta', content);
    return null;
  }
}

/** Announces message to screen readers via aria-live region. */
export function announce(message: string): void {
  const region = getLiveRegion();
  region.textContent = message;
}

function getLiveRegion(): HTMLElement {
  if (!liveRegion || !document.body.contains(liveRegion)) {
    liveRegion = document.getElementById(LIVE_REGION_ID) ?? createLiveRegion();
  }
  return liveRegion;
}

function createLiveRegion(): HTMLElement {
  const el = document.createElement('div');
  el.id = LIVE_REGION_ID;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.style.cssText =
    'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
  document.body.appendChild(el);
  return el;
}

export function resetFeedbackForTests(): void {
  inFlight = 0;
  teardown?.();
  teardown = null;
  liveRegion?.remove();
  liveRegion = null;
  activeElements.clear();
  document.body?.removeAttribute('data-flux-offline');
}
