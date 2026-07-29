// fx-page: Pagination & Load-More preset. Expands to hx-get with configurable swap strategy (append, prepend, replace).

import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';
import { log } from '../core/logger.js';

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

  if (options.append && options.prepend) {
    log.warn(
      '[flux] fx-append and fx-prepend cannot be used together on the same element; enforcing fx-append',
    );
  }

  setGeneratedAttribute(element, 'hx-get', options.url.trim());

  const swapMethod = options.append ? 'beforeend' : options.prepend ? 'afterbegin' : undefined;
  if (swapMethod) {
    setGeneratedAttribute(element, 'hx-swap', swapMethod);
  } else {
    removeGeneratedAttribute(element, 'hx-swap');
  }

  if (options.target && options.target.trim()) {
    setGeneratedAttribute(element, 'hx-target', options.target.trim());
  } else {
    removeGeneratedAttribute(element, 'hx-target');
  }

  if (options.indicator && options.indicator.trim()) {
    setGeneratedAttribute(element, 'hx-indicator', options.indicator.trim());
  } else {
    removeGeneratedAttribute(element, 'hx-indicator');
  }

  element.setAttribute('data-flux-preset', 'page');
  return true;
}
