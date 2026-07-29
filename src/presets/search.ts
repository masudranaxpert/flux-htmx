// fx-search preset — native debounce + min-length without eval, optional clear-button wiring.
// No HTMX trigger filters (which require eval); we intercept input events ourselves.

import { log } from '../core/logger.js';
import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';

export interface SearchOptions {
  url: string;
  target?: string;
  delay?: string;
  minLength?: string;
  indicator?: string;
  clearSelector?: string; // e.g. "#clearBtn" — element that clears the input on click
}

const DEFAULT_DELAY_MS = 300;
const SEARCH_PRESET = 'search';

// WeakMap so listeners clean up automatically with the element.
const searchControllers = new WeakMap<HTMLElement, () => void>();

/**
 * Expands `fx-search` into HTMX attributes with native debounce + min-length.
 * Returns false when element is not HTMLInputElement/HTMLElement or URL is empty.
 */
export function applySearch(element: Element, options: SearchOptions): boolean {
  if (!(element instanceof HTMLElement) || !options.url?.trim()) return false;

  // Tear down any previous controller (idempotent reconnect).
  disconnectSearch(element);

  const delayMs = parseDelayMs(options.delay);
  const minLength = parseMinLength(options.minLength);

  // HTMX still owns the actual request. We only gate firing via the native listener.
  setGeneratedAttribute(element, 'hx-get', options.url);
  // Trigger: manual — we call htmx.trigger() ourselves after debounce + min-length check.
  setGeneratedAttribute(element, 'hx-trigger', 'flux:search-ready');
  setGeneratedAttribute(element, 'hx-sync', 'this:replace');
  element.setAttribute('data-flux-preset', SEARCH_PRESET);

  syncOptionalAttribute(element, 'hx-target', options.target);
  syncOptionalAttribute(element, 'hx-indicator', options.indicator);

  // Native debounced input listener — zero eval.
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onInput = () => {
    clearTimeout(timer);
    const val = (element as HTMLInputElement).value ?? '';
    if (minLength !== undefined && val.trim().length < minLength) return;
    timer = setTimeout(() => {
      element.dispatchEvent(new CustomEvent('flux:search-ready', { bubbles: true }));
    }, delayMs);
  };

  element.addEventListener('input', onInput);

  // Optional clear-button support.
  let clearCleanup: (() => void) | undefined;
  if (options.clearSelector) {
    const clearEl = document.querySelector(options.clearSelector);
    if (clearEl instanceof HTMLElement) {
      const onClear = () => {
        (element as HTMLInputElement).value = '';
        clearTimeout(timer);
        // Fire an empty search so results reset.
        element.dispatchEvent(new CustomEvent('flux:search-ready', { bubbles: true }));
        element.focus();
      };
      clearEl.addEventListener('click', onClear);
      clearCleanup = () => clearEl.removeEventListener('click', onClear);
    } else {
      log.warn(`fx-search: clear selector "${options.clearSelector}" not found`);
    }
  }

  searchControllers.set(element, () => {
    clearTimeout(timer);
    element.removeEventListener('input', onInput);
    clearCleanup?.();
    searchControllers.delete(element);
  });

  return true;
}

export function disconnectSearch(element: Element): void {
  if (element instanceof HTMLElement) {
    searchControllers.get(element)?.();
  }
}

// --- helpers ---

function syncOptionalAttribute(element: Element, name: string, value?: string): void {
  if (value?.trim()) {
    setGeneratedAttribute(element, name, value);
  } else {
    removeGeneratedAttribute(element, name);
  }
}

function parseDelayMs(value?: string): number {
  const s = value?.trim();
  if (!s) return DEFAULT_DELAY_MS;
  if (/^\d+$/.test(s)) return Number(s);           // bare number → ms
  if (/^\d+ms$/i.test(s)) return parseInt(s, 10);  // "300ms"
  if (/^\d+s$/i.test(s)) return parseInt(s, 10) * 1000; // "1s"
  return DEFAULT_DELAY_MS;
}

function parseMinLength(value?: string): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
