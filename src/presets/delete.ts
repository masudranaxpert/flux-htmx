// fx-delete: high-level delete preset. Expands to hx-delete and attaches
// confirmation, item removal, success notification, and cache invalidation mechanics.

import { queryOne, safeClosest } from '../core/selectors.js';
import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';
import { getRequestContext } from '../core/events.js';

export interface DeleteOptions {
  url: string;
  confirm?: string;
  target?: string;
  remove?: string;
  swap?: string;
  indicator?: string;
  success?: string;
  invalidate?: string;
}

const deleteControllers = new WeakMap<Element, () => void>();
const activeDeleteDisposers = new Set<() => void>();

function isValidUrlValue(value?: string | null): value is string {
  return Boolean(value?.trim());
}

export function applyDelete(element: Element, options: DeleteOptions): boolean {
  if (!(element instanceof HTMLElement) || !isValidUrlValue(options.url)) return false;

  setGeneratedAttribute(element, 'hx-delete', options.url);

  syncOptionalAttribute(element, 'hx-confirm', options.confirm);
  syncOptionalAttribute(element, 'hx-target', options.target);
  syncOptionalAttribute(element, 'hx-swap', options.swap);
  syncOptionalAttribute(element, 'hx-indicator', options.indicator);

  syncDomAttribute(element, 'fx-success', options.success);
  syncDomAttribute(element, 'fx-invalidate', options.invalidate);

  if (options.remove && options.remove.trim()) {
    element.setAttribute('data-flux-remove', options.remove);
    wireDeleteRemove(element, options.remove);
  } else {
    element.removeAttribute('data-flux-remove');
    deleteControllers.get(element)?.();
  }

  element.setAttribute('data-flux-preset', 'delete');
  return true;
}

function syncOptionalAttribute(element: Element, name: string, value?: string): void {
  if (value && value.trim()) {
    setGeneratedAttribute(element, name, value);
  } else {
    removeGeneratedAttribute(element, name);
  }
}

function syncDomAttribute(element: Element, name: string, value?: string): void {
  if (value && value.trim()) {
    element.setAttribute(name, value);
  } else {
    element.removeAttribute(name);
  }
}

function wireDeleteRemove(element: Element, removeSelector: string): void {
  deleteControllers.get(element)?.();

  const onAfterRequest = (evt: Event) => {
    const ctx = getRequestContext(evt);
    if (evt.target !== element && ctx.source !== element) return;

    if (ctx.successful) {
      const target = resolveRemoveTarget(element, removeSelector);
      target?.remove();
    }
  };

  element.addEventListener('htmx:after:request', onAfterRequest);

  const cleanup = () => {
    element.removeEventListener('htmx:after:request', onAfterRequest);
    deleteControllers.delete(element);
    activeDeleteDisposers.delete(cleanup);
  };

  deleteControllers.set(element, cleanup);
  activeDeleteDisposers.add(cleanup);
}

export function resolveRemoveTarget(element: Element, selector: string): Element | null {
  const trimmed = selector.trim();
  if (trimmed === 'this' || trimmed === 'self') return element;
  if (trimmed === 'closest tr' || trimmed === 'closest li' || trimmed.startsWith('closest ')) {
    const tag = trimmed.replace('closest ', '').trim();
    return safeClosest(element, tag);
  }
  return queryOne(trimmed, typeof document !== 'undefined' ? document : element.ownerDocument);
}

export { resolveRemoveTarget as resolveRemovalTarget };

export function disconnectDelete(element: Element): void {
  deleteControllers.get(element)?.();
}

export function disposeDeleteControllers(): void {
  for (const cleanup of Array.from(activeDeleteDisposers)) {
    cleanup();
  }
  activeDeleteDisposers.clear();
  if (typeof document !== 'undefined') {
    for (const el of Array.from(document.querySelectorAll('[data-flux-preset="delete"]'))) {
      el.removeAttribute('data-flux-preset');
    }
  }
}

let isDeleteInstalled = false;

export function installDeleteControllers(): () => void {
  if (typeof document === 'undefined' || isDeleteInstalled) return () => {};
  isDeleteInstalled = true;

  const onCleanup = (evt: Event) => {
    const target = (evt as CustomEvent).detail?.ctx?.targetElement ?? evt.target;
    if (target instanceof Element) {
      deleteControllers.get(target)?.();
      for (const el of Array.from(target.querySelectorAll('[data-flux-preset="delete"]'))) {
        deleteControllers.get(el)?.();
      }
    }
  };

  document.addEventListener('htmx:before:cleanup', onCleanup);
  return () => {
    document.removeEventListener('htmx:before:cleanup', onCleanup);
    isDeleteInstalled = false;
  };
}
