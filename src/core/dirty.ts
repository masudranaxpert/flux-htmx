// Form dirty tracking (form[fx-dirty]).
// Tracks original input values on data-fx-original, marks mutated inputs with
// data-dirty="true", and toggles data-dirty="true" on the parent form.

import { queryAllSafely } from './selectors.js';

export function initializeDirtyState(root: Element | Document = document): void {
  const forms: Element[] = [];
  if (root instanceof Element && root.matches('form[fx-dirty]')) {
    forms.push(root);
  }
  forms.push(...queryAllSafely('form[fx-dirty]', root));
  for (const form of forms) {
    const inputs = queryAllSafely('input, select, textarea', form);
    for (const el of inputs) {
      const input = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      const val =
        input.type === 'checkbox' ? (input as HTMLInputElement).checked.toString() : input.value;
      input.setAttribute('data-fx-original', val);
    }

    if (form.hasAttribute('fx-disable-clean')) {
      const submitBtn = form.querySelector('[type="submit"]') as HTMLButtonElement;
      if (submitBtn) submitBtn.setAttribute('disabled', 'true');
    }
  }
}

export function handleFormInput(e: Event): void {
  const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  if (!target || !target.closest('form[fx-dirty]')) return;

  const form = target.closest('form[fx-dirty]') as HTMLFormElement;
  if (!form) return;

  const originalValue = target.getAttribute('data-fx-original');
  const currentValue =
    target.type === 'checkbox' ? (target as HTMLInputElement).checked.toString() : target.value;

  if (originalValue !== currentValue) {
    target.setAttribute('data-dirty', 'true');
  } else {
    target.removeAttribute('data-dirty');
  }

  // Check form level dirty
  const isFormDirty = form.querySelector('[data-dirty]') !== null;
  if (isFormDirty) {
    form.setAttribute('data-dirty', 'true');
    const submitBtn = form.querySelector('[type="submit"]') as HTMLButtonElement;
    if (submitBtn) {
      submitBtn.removeAttribute('disabled');
    }
  } else {
    form.removeAttribute('data-dirty');
    const submitBtn = form.querySelector('[type="submit"]') as HTMLButtonElement;
    if (submitBtn && form.hasAttribute('fx-disable-clean')) {
      submitBtn.setAttribute('disabled', 'true');
    }
  }
}

export function installDirtyTracking(): () => void {
  if (typeof document === 'undefined') return () => {};

  document.addEventListener('input', handleFormInput);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeDirtyState(), { once: true });
  } else {
    initializeDirtyState();
  }

  const onSettle = (e: Event) => {
    const el = (e as CustomEvent).detail?.el;
    initializeDirtyState(el instanceof Element ? el : document);
  };
  document.addEventListener('htmx:after:settle', onSettle);

  return () => {
    document.removeEventListener('input', handleFormInput);
    document.removeEventListener('htmx:after:settle', onSettle);
  };
}
