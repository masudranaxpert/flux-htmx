import { log } from '../core/logger.js';
import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';

export interface AutosaveOptions {
  url: string;
  delay?: string;
  target?: string;
  indicator?: string;
}

const VALID_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

export function applyAutosave(element: Element, options: AutosaveOptions): boolean {
  if (!(element instanceof HTMLElement) || !options.url || !options.url.trim()) {
    return false;
  }

  const rawMethod = element.getAttribute('fx-method')?.toLowerCase() ?? 'post';
  const method = VALID_METHODS.has(rawMethod) ? rawMethod : 'post';
  if (!VALID_METHODS.has(rawMethod)) {
    log.warn(`invalid fx-method "${rawMethod}" on autosave element; falling back to "post"`);
  }

  // Remove other HTTP verb attributes if method changed
  for (const m of VALID_METHODS) {
    if (m !== method) {
      removeGeneratedAttribute(element, `hx-${m}`);
    }
  }

  const delay = options.delay ?? '500ms';
  const sig = JSON.stringify({
    url: options.url,
    method,
    delay,
    target: options.target,
    indicator: options.indicator,
  });
  if (
    element.getAttribute('data-flux-preset') === 'autosave' &&
    element.getAttribute('data-flux-preset-signature') === sig
  ) {
    return false;
  }

  setGeneratedAttribute(element, `hx-${method}`, options.url);
  setGeneratedAttribute(element, 'hx-trigger', `input changed delay:${delay}, change changed`);
  setGeneratedAttribute(element, 'hx-sync', 'this:replace');

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

  element.setAttribute('data-flux-preset', 'autosave');
  element.setAttribute('data-flux-preset-signature', sig);

  return true;
}
