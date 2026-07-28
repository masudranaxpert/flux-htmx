// Component controllers. Most Flux components are pure native HTML (<dialog>, <details>,
// <progress>); these controllers add behaviour the platform does not provide out of the box:
//   - fx-open="#id" → opens a <dialog> (with focus & focus restoration) or toggles a popover
//   - fx-close="#id" / fx-close → closes target <dialog> or popover
//   - fx-confirm-dialog="#id" → native HTML <dialog> confirmation before issuing request
//   - fx-toast-region → mounts an accessible live region Alpine can populate

import { log } from '../core/logger.js';

const OPEN_ATTR = 'fx-open';
const CLOSE_ATTR = 'fx-close';

interface ActiveConfirmationState {
  dialog: HTMLDialogElement;
  cleanup: () => void;
  dropRequest?: () => void;
}

const openers = new WeakMap<HTMLDialogElement, HTMLElement>();
const dialogControllers = new WeakMap<HTMLDialogElement, () => void>();
const activeConfirmations = new WeakMap<HTMLDialogElement, ActiveConfirmationState>();
const activeConfirmationsList = new Set<ActiveConfirmationState>();
const activeDialogDisposers = new Set<() => void>();

/** Safely queries a selector without throwing DOMExceptions on invalid selector syntax. */
export function safeQuerySelector(selector: string, context?: Element | Document): Element | null {
  if (!selector || typeof selector !== 'string') return null;
  try {
    return (context ?? document).querySelector(selector);
  } catch (e) {
    log.warn(`invalid CSS selector "${selector}" in component attribute:`, e);
    return null;
  }
}

/** Installs the fx-open, fx-close, and fx-confirm-dialog delegation. Returns a teardown for tests. */
export function installOpenController(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onClick = (evt: Event) => {
    const targetEl = evt.target as Element | null;
    if (!targetEl) return;

    // Handle fx-open
    const openTarget = targetEl.closest(`[${OPEN_ATTR}]`);
    if (openTarget instanceof Element) {
      const selector = openTarget.getAttribute(OPEN_ATTR);
      if (!selector) return;

      const el = safeQuerySelector(selector);
      if (el instanceof HTMLDialogElement) {
        if (!openers.has(el)) {
          const opener = (document.activeElement as HTMLElement) ?? (openTarget as HTMLElement);
          openers.set(el, opener);
        }

        if (!el.open && typeof el.showModal === 'function') {
          el.showModal();
        }

        // Wire focus restoration on close event
        if (!dialogControllers.has(el)) {
          const onClose = () => {
            const previousOpener = openers.get(el);
            if (previousOpener && document.body.contains(previousOpener)) {
              previousOpener.focus();
            }
            openers.delete(el);
          };
          el.addEventListener('close', onClose);

          const cleanup = () => {
            el.removeEventListener('close', onClose);
            el.removeAttribute('data-flux-close-wired');
            dialogControllers.delete(el);
            activeDialogDisposers.delete(cleanup);
          };

          dialogControllers.set(el, cleanup);
          activeDialogDisposers.add(cleanup);
          el.setAttribute('data-flux-close-wired', '1');
        }

        // Move focus into the dialog for keyboard users.
        const focusable = el.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        focusable?.focus();
        evt.preventDefault();
        return;
      } else if (el instanceof HTMLElement && typeof el.showPopover === 'function') {
        const opener = (document.activeElement as HTMLElement) ?? (openTarget as HTMLElement);
        if (!openers.has(el as unknown as HTMLDialogElement)) {
          openers.set(el as unknown as HTMLDialogElement, opener);
        }
        el.showPopover();
        evt.preventDefault();
        return;
      }
    }

    // Handle fx-close
    const closeTarget = targetEl.closest(`[${CLOSE_ATTR}]`);
    if (closeTarget instanceof Element) {
      const selector = closeTarget.getAttribute(CLOSE_ATTR);
      const el = selector ? safeQuerySelector(selector) : closeTarget.closest('dialog');

      if (el instanceof HTMLDialogElement) {
        if (typeof el.close === 'function') {
          el.close();
        }
        evt.preventDefault();
      } else if (el instanceof HTMLElement && typeof el.hidePopover === 'function') {
        el.hidePopover();
        const opener = openers.get(el as unknown as HTMLDialogElement);
        if (opener && document.body.contains(opener)) {
          opener.focus();
        }
        openers.delete(el as unknown as HTMLDialogElement);
        evt.preventDefault();
      }
    }
  };

  // Handle fx-confirm-dialog
  const onConfirm = (evt: Event) => {
    const detail = (evt as CustomEvent).detail as
      | { elt?: Element; issueRequest?: (skipConfirm?: boolean) => void; dropRequest?: () => void }
      | undefined;
    const elt = detail?.elt;
    if (!elt) return;

    const dialogSelector = elt.getAttribute('fx-confirm-dialog');
    if (!dialogSelector) return;

    const dialog = safeQuerySelector(dialogSelector);
    if (dialog instanceof HTMLDialogElement && detail.issueRequest) {
      evt.preventDefault();

      // Cancel and drop any existing pending confirmation on this dialog
      const existingState = activeConfirmations.get(dialog);
      if (existingState) {
        existingState.dropRequest?.();
        existingState.cleanup();
      }

      let isConfirmed = false;
      let state: ActiveConfirmationState;

      const cleanup = () => {
        dialog.removeEventListener('click', onConfirmClick);
        dialog.removeEventListener('close', onClose);
        if (typeof dialog.close === 'function') {
          try {
            dialog.close();
          } catch {
            // Already closed
          }
        }
        activeConfirmations.delete(dialog);
        if (state) activeConfirmationsList.delete(state);
      };

      const onConfirmClick = (clickEvt: Event) => {
        const target = clickEvt.target as Element;

        // Cancel target matched FIRST
        const cancelBtn = target?.closest?.('[data-flux-cancel], [formmethod="dialog"], .cancel');
        if (cancelBtn) {
          cleanup();
          detail.dropRequest?.();
          return;
        }

        // Confirm target matched SECOND
        const confirmBtn = target?.closest?.('[data-flux-confirm], .confirm');
        if (confirmBtn) {
          isConfirmed = true;
          cleanup();
          detail.issueRequest?.(true);
        }
      };

      const onClose = () => {
        cleanup();
        if (!isConfirmed) {
          detail.dropRequest?.();
        }
      };

      state = { dialog, cleanup, dropRequest: detail.dropRequest };
      activeConfirmations.set(dialog, state);
      activeConfirmationsList.add(state);

      dialog.addEventListener('click', onConfirmClick);
      dialog.addEventListener('close', onClose);

      if (!dialog.open && typeof dialog.showModal === 'function') {
        dialog.showModal();
      }
    }
  };

  document.addEventListener('click', onClick);
  document.addEventListener('htmx:confirm', onConfirm);

  return () => {
    document.removeEventListener('click', onClick);
    document.removeEventListener('htmx:confirm', onConfirm);
    disposeDialogControllers();
  };
}

export function disposeDialogControllers(): void {
  for (const cleanup of Array.from(activeDialogDisposers)) {
    cleanup();
  }
  activeDialogDisposers.clear();

  for (const state of Array.from(activeConfirmationsList)) {
    try {
      state.dropRequest?.();
      state.cleanup();
    } catch {
      // Ignore cleanup error
    }
  }
  activeConfirmationsList.clear();
}

/** Creates and returns the toast live region element (role=status, aria-live=polite). */
export function createToastRegion(): HTMLElement {
  const region = document.createElement('div');
  region.className = 'flux-toast-region';
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', 'Notifications');
  document.body.appendChild(region);
  return region;
}
