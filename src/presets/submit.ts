// fx-submit: high-level form submit preset. Expands to hx-post (or valid verb) by default,
// configuring target, swap, indicator, reset, disable, focus-error, and form submit handling.

import { log } from '../core/logger.js';
import { queryAllSafely } from '../core/utils.js';
import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';
import { getRequestContext } from '../core/events.js';

export interface SubmitOptions {
  url: string;
  target?: string;
  swap?: string;
  indicator?: string;
  confirm?: string;
  success?: string;
  error?: string;
  invalidate?: string;
  reset?: boolean;
  disable?: string;
  focusError?: boolean;
  errors?: string;
}

const ALLOWED_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

const submitControllers = new WeakMap<Element, () => void>();
const activeSubmitDisposers = new Set<() => void>();

function isValidUrlValue(value?: string | null): value is string {
  return Boolean(value?.trim());
}

export function applySubmit(element: Element, options: SubmitOptions): boolean {
  if (!(element instanceof HTMLElement) || !isValidUrlValue(options.url)) return false;

  const rawMethod = element.getAttribute('fx-method')?.toLowerCase() ?? 'post';
  const method = ALLOWED_METHODS.has(rawMethod) ? rawMethod : 'post';
  if (!ALLOWED_METHODS.has(rawMethod)) {
    log.warn(`invalid fx-method "${rawMethod}" on submit element; falling back to "post"`);
  }

  // Remove other HTTP verb attributes if method changed
  for (const m of ALLOWED_METHODS) {
    if (m !== method) {
      removeGeneratedAttribute(element, `hx-${m}`);
    }
  }

  setGeneratedAttribute(element, `hx-${method}`, options.url);

  syncOptionalAttribute(element, 'hx-target', options.target);
  syncOptionalAttribute(element, 'hx-swap', options.swap);
  syncOptionalAttribute(element, 'hx-indicator', options.indicator);
  syncOptionalAttribute(element, 'hx-confirm', options.confirm);

  syncDomAttribute(element, 'fx-success', options.success);
  syncDomAttribute(element, 'fx-error', options.error);
  syncDomAttribute(element, 'fx-invalidate', options.invalidate);

  wireSubmitHandlers(element);

  element.setAttribute('data-flux-preset', 'submit');
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

function wireSubmitHandlers(element: Element): void {
  submitControllers.get(element)?.();

  const rawDisableAttr = element.getAttribute('fx-disable');
  const isDisableOptOut = rawDisableAttr === 'false';
  const disableSelector = isDisableOptOut
    ? null
    : (rawDisableAttr ?? 'button:not([type]), button[type="submit"], input[type="submit"]');

  const onBefore = (evt: Event) => {
    const ctx = getRequestContext(evt);
    if (evt.target !== element && ctx.source !== element) return;

    if (disableSelector) {
      const controls = queryAllSafely<HTMLButtonElement | HTMLInputElement>(
        element,
        disableSelector,
      );
      for (const ctrl of controls) {
        if (!ctrl.hasAttribute('data-flux-disable-count')) {
          ctrl.setAttribute('data-flux-was-disabled', ctrl.disabled ? '1' : '0');
          ctrl.setAttribute('data-flux-disable-count', '1');
        } else {
          const currentCount = Number(ctrl.getAttribute('data-flux-disable-count') ?? '0');
          ctrl.setAttribute('data-flux-disable-count', String(currentCount + 1));
        }
        ctrl.disabled = true;
      }
    }
  };

  const onFinally = (evt: Event) => {
    const ctx = getRequestContext(evt);
    if (evt.target !== element && ctx.source !== element) return;

    if (disableSelector) {
      const controls = queryAllSafely<HTMLButtonElement | HTMLInputElement>(
        element,
        disableSelector,
      );
      for (const ctrl of controls) {
        const count = Number(ctrl.getAttribute('data-flux-disable-count') ?? '1');
        if (count <= 1) {
          const wasDisabled = ctrl.getAttribute('data-flux-was-disabled') === '1';
          ctrl.disabled = wasDisabled;
          ctrl.removeAttribute('data-flux-disable-count');
          ctrl.removeAttribute('data-flux-was-disabled');
        } else {
          ctrl.setAttribute('data-flux-disable-count', String(count - 1));
        }
      }
    }
  };

  const onAfter = (evt: Event) => {
    const ctx = getRequestContext(evt);
    if (evt.target !== element && ctx.source !== element) return;

    const successful = ctx.successful;
    const status = ctx.status;
    const shouldReset =
      element.hasAttribute('fx-reset') && element.getAttribute('fx-reset') !== 'false';

    if (successful) {
      if (shouldReset && element instanceof HTMLFormElement) {
        element.reset();
      }
      clearFieldErrors(element);
    } else if (status === 422) {
      handle422Errors(element, ctx);
    }
  };

  element.addEventListener('htmx:before:request', onBefore);
  element.addEventListener('htmx:after:request', onAfter);
  element.addEventListener('htmx:finally:request', onFinally);

  const cleanup = () => {
    restoreDisabledControls(element);
    element.removeEventListener('htmx:before:request', onBefore);
    element.removeEventListener('htmx:after:request', onAfter);
    element.removeEventListener('htmx:finally:request', onFinally);
    submitControllers.delete(element);
    activeSubmitDisposers.delete(cleanup);
  };

  submitControllers.set(element, cleanup);
  activeSubmitDisposers.add(cleanup);
}

function restoreDisabledControls(element: Element): void {
  for (const ctrl of Array.from(
    element.querySelectorAll<HTMLButtonElement | HTMLInputElement>('[data-flux-disable-count]'),
  )) {
    const wasDisabled = ctrl.getAttribute('data-flux-was-disabled') === '1';
    ctrl.disabled = wasDisabled;
    ctrl.removeAttribute('data-flux-disable-count');
    ctrl.removeAttribute('data-flux-was-disabled');
  }
}

function handle422Errors(element: Element, ctx: any): void {
  clearFieldErrors(element);
  const responseText = ctx.text;

  if (responseText) {
    try {
      const data = JSON.parse(responseText);
      const errors = data.errors ?? data;
      if (typeof errors === 'object' && errors !== null) {
        const errorSlots = Array.from(element.querySelectorAll('[data-flux-field-error]'));
        for (const [field, msg] of Object.entries(errors)) {
          const slot = errorSlots.find((el) => el.getAttribute('data-flux-field-error') === field);
          if (slot) slot.textContent = String(msg);
        }
      }
    } catch {
      // Non-JSON response text
    }
  }

  if (element.hasAttribute('fx-focus-error')) {
    const errorSlots = Array.from(element.querySelectorAll('[data-flux-field-error]'));
    const firstPopulatedSlot = errorSlots.find(
      (el) => el.textContent && el.textContent.trim().length > 0,
    );
    const fieldName = firstPopulatedSlot?.getAttribute('data-flux-field-error');

    let targetInput: HTMLElement | null = null;
    if (fieldName) {
      const inputs = Array.from(element.querySelectorAll<HTMLElement>('input, select, textarea'));
      targetInput = inputs.find((inp) => inp.getAttribute('name') === fieldName) ?? null;
    }

    const firstInvalid =
      targetInput ??
      element.querySelector<HTMLElement>(':invalid') ??
      element.querySelector<HTMLElement>('input, select, textarea');
    firstInvalid?.focus();
  }
}

function clearFieldErrors(element: Element): void {
  for (const slot of Array.from(element.querySelectorAll('[data-flux-field-error]'))) {
    slot.textContent = '';
  }
}

export function disconnectSubmit(element: Element): void {
  submitControllers.get(element)?.();
}

export function disposeSubmitControllers(): void {
  for (const cleanup of Array.from(activeSubmitDisposers)) {
    cleanup();
  }
  activeSubmitDisposers.clear();
  if (typeof document !== 'undefined') {
    for (const el of Array.from(document.querySelectorAll('[data-flux-preset="submit"]'))) {
      el.removeAttribute('data-flux-preset');
    }
  }
}

let isSubmitInstalled = false;

export function installSubmitControllers(): () => void {
  if (typeof document === 'undefined' || isSubmitInstalled) return () => {};
  isSubmitInstalled = true;

  const onCleanup = (evt: Event) => {
    const target = (evt as CustomEvent).detail?.ctx?.targetElement ?? evt.target;
    if (target instanceof Element) {
      submitControllers.get(target)?.();
      for (const el of Array.from(target.querySelectorAll('[data-flux-preset="submit"]'))) {
        submitControllers.get(el)?.();
      }
    }
  };

  document.addEventListener('htmx:before:cleanup', onCleanup);
  return () => {
    document.removeEventListener('htmx:before:cleanup', onCleanup);
    isSubmitInstalled = false;
  };
}
