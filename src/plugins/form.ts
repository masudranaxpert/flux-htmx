import { queryAllSafely } from '../core/selectors.js';

export function installForm() {
  document.addEventListener('click', handleFormClick);
  document.addEventListener('input', handleFormInput);

  // Track original values. readyState-aware: deferred or dynamic scripts load after
  // DOMContentLoaded has already fired.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeDirtyState(), { once: true });
  } else {
    initializeDirtyState();
  }
  document.addEventListener('htmx:after:settle', (e: Event) => {
    initializeDirtyState((e as CustomEvent).detail.el);
  });
}

function handleFormClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  const toggle = target.closest('[fx-password-toggle]');
  if (toggle) {
    const targetId = toggle.getAttribute('fx-password-toggle');
    if (!targetId) return;

    const input = document.getElementById(targetId) as HTMLInputElement;
    if (input && input.tagName === 'INPUT') {
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', isPassword.toString());
    }
  }
}

function handleFormInput(e: Event) {
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

function initializeDirtyState(root: Element | Document = document) {
  const forms = queryAllSafely('form[fx-dirty]', root);
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
