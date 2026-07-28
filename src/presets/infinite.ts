import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';

export interface InfiniteOptions {
  url: string;
  target?: string;
  indicator?: string;
}

export function applyInfinite(element: Element, options: InfiniteOptions): boolean {
  if (!(element instanceof HTMLElement) || !options.url || !options.url.trim()) {
    return false;
  }

  const sig = JSON.stringify({
    url: options.url,
    target: options.target,
    indicator: options.indicator,
  });
  if (
    element.getAttribute('data-flux-preset') === 'infinite' &&
    element.getAttribute('data-flux-preset-signature') === sig
  ) {
    return false;
  }

  setGeneratedAttribute(element, 'hx-get', options.url);
  setGeneratedAttribute(element, 'hx-trigger', 'revealed');
  setGeneratedAttribute(element, 'hx-sync', 'this:drop');

  syncOptionalAttribute(element, 'hx-target', options.target);
  syncOptionalAttribute(element, 'hx-indicator', options.indicator);

  element.setAttribute('data-flux-preset', 'infinite');
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
