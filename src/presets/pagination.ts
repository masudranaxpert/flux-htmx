// fx-page: Pagination & Load-More preset. Expands to hx-get with configurable swap strategy (append, prepend, replace).

import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';

export interface PaginationOptions {
  url: string;
  target?: string;
  append?: boolean;
  prepend?: boolean;
  indicator?: string;
}

export function applyPagination(element: Element, options: PaginationOptions): boolean {
  if (!(element instanceof HTMLElement) || !options.url || !options.url.trim()) {
    return false;
  }

  setGeneratedAttribute(element, 'hx-get', options.url);

  const swapMethod = options.append ? 'beforeend' : options.prepend ? 'afterbegin' : undefined;
  if (swapMethod) {
    setGeneratedAttribute(element, 'hx-swap', swapMethod);
  } else {
    removeGeneratedAttribute(element, 'hx-swap');
  }

  if (options.target && options.target.trim()) {
    setGeneratedAttribute(element, 'hx-target', options.target);
  } else {
    removeGeneratedAttribute(element, 'hx-target');
  }

  if (options.indicator && options.indicator.trim()) {
    setGeneratedAttribute(element, 'hx-indicator', options.indicator);
  } else {
    removeGeneratedAttribute(element, 'hx-indicator');
  }

  element.setAttribute('data-flux-preset', 'page');
  return true;
}
