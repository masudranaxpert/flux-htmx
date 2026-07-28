import { log } from '../core/logger.js';
import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';

export interface SearchOptions {
  url: string;
  target?: string;
  delay?: string;
  minLength?: string;
  indicator?: string;
}

const DEFAULT_DELAY = '300ms';
const SEARCH_PRESET = 'search';

/**
 * Expands an `fx-search` preset into HTMX attributes on `element`.
 *
 * Returns `false` when `element` is not an `HTMLElement` or has an empty URL.
 */
export function applySearch(element: Element, options: SearchOptions): boolean {
  if (!(element instanceof HTMLElement) || !options.url || !options.url.trim()) {
    return false;
  }

  const delay = normalizeDelay(options.delay);
  const minLength = parseMinLength(options.minLength);

  setGeneratedAttribute(element, 'hx-get', options.url);
  setGeneratedAttribute(element, 'hx-trigger', createSearchTrigger(delay, minLength));
  // `replace` discards an in-flight response if a newer request supersedes it.
  setGeneratedAttribute(element, 'hx-sync', 'this:replace');
  element.setAttribute('data-flux-preset', SEARCH_PRESET);

  syncOptionalAttribute(element, 'hx-target', options.target);
  syncOptionalAttribute(element, 'hx-indicator', options.indicator);

  if (minLength) {
    // HTMX trigger filters require eval support. See docs/attributes/search.md.
    log.url('fx-search trigger filtering requires eval support', options.url);
  }

  return true;
}

function syncOptionalAttribute(element: Element, name: string, value?: string): void {
  if (value && value.trim()) {
    setGeneratedAttribute(element, name, value);
  } else {
    removeGeneratedAttribute(element, name);
  }
}

function normalizeDelay(value?: string): string {
  const normalized = value?.trim();

  if (!normalized) {
    return DEFAULT_DELAY;
  }

  return isBareNumber(normalized) ? `${normalized}ms` : normalized;
}

function parseMinLength(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function createSearchTrigger(delay: string, minLength?: number): string {
  const trigger = `input changed delay:${delay}`;

  return minLength ? `${trigger}[event.target.value.trim().length >= ${minLength}]` : trigger;
}

function isBareNumber(value: string): boolean {
  return /^\d+$/.test(value);
}
