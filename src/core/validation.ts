import { log } from './logger.js';

/**
 * Validates the closest form of elements marked with `fx-validate`.
 * If invalid, the HTMX request is aborted.
 */
export function installValidation(): (() => void) | null {
  if (typeof document === 'undefined') return null;

  document.addEventListener('htmx:config:request', onValidate);
  document.addEventListener('htmx:confirm', onConfirm);
  return () => {
    document.removeEventListener('htmx:config:request', onValidate);
    document.removeEventListener('htmx:confirm', onConfirm);
  };
}

function onValidate(evt: Event): void {
  const customEvt = evt as CustomEvent;
  const detail = customEvt.detail;
  const elt = (detail?.ctx?.sourceElement ?? detail?.elt) as Element | undefined;
  if (!elt) return;

  // Check if elt or its parent form has fx-validate
  const hasValidate = elt.hasAttribute('fx-validate') || elt.closest('form[fx-validate]');
  if (!hasValidate) return;

  const form = elt.closest('form');
  if (!form) return;

  if (!form.reportValidity()) {
    log.info('[flux] Form validation failed, aborting request.');
    evt.preventDefault();
    detail.dropRequest?.();
  }
}

// Keep validation compatible with explicit hx-confirm while config:request covers fx-validate alone.
const onConfirm = onValidate;
