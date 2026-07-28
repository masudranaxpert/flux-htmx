import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';

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
