import { log } from './logger.js';

/**
 * Validates the closest form of elements marked with `fx-validate`.
 * If invalid, the HTMX request is aborted.
 */
export function installValidation(): (() => void) | null {
  if (typeof document === 'undefined') return null;

  document.addEventListener('htmx:confirm', onConfirm);
  return () => {
    document.removeEventListener('htmx:confirm', onConfirm);
  };
}

function onConfirm(evt: Event): void {
  const customEvt = evt as CustomEvent;
  const elt = customEvt.detail?.elt as Element | undefined;
  if (!elt) return;

  // Check if elt or its parent form has fx-validate
  const hasValidate = elt.hasAttribute('fx-validate') || elt.closest('form[fx-validate]');
  if (!hasValidate) return;

  const form = elt.closest('form');
  if (!form) return;

  if (!form.reportValidity()) {
    log.info('[flux] Form validation failed, aborting request.');
    evt.preventDefault(); // This stops the htmx request
  }
}
