import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';
import { resolveHtmx } from '../core/startup.js';
import htmx from 'htmx.org';

export interface PollOptions {
  url: string;
  interval: string;
  target?: string;
  indicator?: string;
}

export function applyPoll(element: Element, options: PollOptions): boolean {
  if (
    !(element instanceof HTMLElement) ||
    !options.url ||
    !options.url.trim() ||
    !options.interval
  ) {
    return false;
  }

  const interval = normalizeInterval(options.interval);
  const sig = JSON.stringify({
    url: options.url,
    interval,
    target: options.target,
    indicator: options.indicator,
  });
  if (
    element.getAttribute('data-flux-preset') === 'poll' &&
    element.getAttribute('data-flux-preset-signature') === sig
  ) {
    return false;
  }

  setGeneratedAttribute(element, 'hx-get', options.url);
  setGeneratedAttribute(element, 'hx-trigger', `every ${interval}`);
  setGeneratedAttribute(element, 'hx-sync', 'this:replace');

  syncOptionalAttribute(element, 'hx-target', options.target);
  syncOptionalAttribute(element, 'hx-indicator', options.indicator);

  element.setAttribute('data-flux-preset', 'poll');
  element.setAttribute('data-flux-preset-signature', sig);

  return true;
}

function syncOptionalAttribute(element: Element, name: string, value?: string): void {
  if (value && value.trim()) {
    setGeneratedAttribute(element, name, value);
  } else {
    removeGeneratedAttribute(element, name);
  }
}

function normalizeInterval(value: string): string {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? `${trimmed}ms` : trimmed;
}

/**
 * Pauses `every`-style polling while the tab is hidden (htmx 4 does not do this
 * itself). On return to visibility each polled element fires once immediately and
 * its polling timer restarts.
 */
export function installPollVisibilityPause(): () => void {
  if (typeof document === 'undefined') return () => {};

  const polled = () => Array.from(document.querySelectorAll('[data-flux-preset="poll"]'));
  type Loose = {
    remove?: (el: Element) => void;
    ajax?: (m: string, u: string, el: Element) => unknown;
    process?: (el: Element) => void;
  };
  const htmxApi = (): Loose | undefined =>
    (window as { htmx?: Loose }).htmx ?? (htmx as unknown as Loose);

  const onVisibility = () => {
    const api = htmxApi();
    if (!api) return;
    const elements = polled();
    if (document.visibilityState === 'hidden') {
      for (const el of elements) api.remove?.(el); // cancels the internal poll timer
    } else if (elements.length > 0) {
      for (const el of elements) {
        const url = el.getAttribute('hx-get');
        if (url && api.ajax) void api.ajax('GET', url, el);
        api.process?.(el); // restarts the every-N timer
      }
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}
