import { handleFormInput, initializeDirtyState, installDirtyTracking } from '../core/dirty.js';

export { handleFormInput, initializeDirtyState, installDirtyTracking };

export function installForm(): () => void {
  document.addEventListener('click', handleFormClick);
  document.addEventListener('input', handleFormInput);

  onReadyForm(() => initializeDirtyState());
  document.addEventListener('htmx:after:settle', handleFormSettle);

  return () => {
    document.removeEventListener('click', handleFormClick);
    document.removeEventListener('input', handleFormInput);
    document.removeEventListener('htmx:after:settle', handleFormSettle);
  };
}

function handleFormSettle(e: Event) {
  initializeDirtyState((e as CustomEvent).detail.el);
}

function onReadyForm(fn: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
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
