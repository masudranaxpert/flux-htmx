import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';

export interface LoadOptions {
  url: string;
  target?: string;
  swap?: string;
  indicator?: string;
}

export function applyLoad(element: Element, options: LoadOptions): boolean {
  if (!(element instanceof HTMLElement) || !options.url || !options.url.trim()) {
    return false;
  }

  const sig = JSON.stringify({
    url: options.url,
    target: options.target,
    swap: options.swap,
    indicator: options.indicator,
  });
  if (
    element.getAttribute('data-flux-preset') === 'load' &&
    element.getAttribute('data-flux-preset-signature') === sig
  ) {
    return false;
  }

  setGeneratedAttribute(element, 'hx-get', options.url);
  setGeneratedAttribute(element, 'hx-trigger', 'load');

  syncOptionalAttribute(element, 'hx-target', options.target);
  syncOptionalAttribute(element, 'hx-swap', options.swap);
  syncOptionalAttribute(element, 'hx-indicator', options.indicator);

  element.setAttribute('data-flux-preset', 'load');
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
