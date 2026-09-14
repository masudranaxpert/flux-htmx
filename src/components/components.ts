// Component controllers. Most Flux components are pure native HTML (<dialog>, <details>,
// <progress>); these controllers add behaviour the platform does not provide out of the box:
//   - fx-open="#id" → opens a <dialog> (with focus & focus restoration) or toggles a popover
//   - fx-close="#id" / fx-close → closes target <dialog> or popover
//   - fx-confirm-dialog="#id" → native HTML <dialog> confirmation before issuing request
//   - fx-toast-region → mounts an accessible live region Flux can populate

import { log } from '../core/logger.js';
import { runtimeConfig } from '../core/runtime.js';

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
function wireDialogControllers(dialog: HTMLDialogElement): void {
  if (dialogControllers.has(dialog)) return;

  const onCancel = (e: Event) => {
    if (dialog.querySelector('form[fx-dirty][data-dirty="true"]')) {
      const form = dialog.querySelector('form[fx-dirty][data-dirty="true"]');
      const msg =
        dialog.getAttribute('fx-dirty-message') ??
        form?.getAttribute('fx-dirty-message') ??
        runtimeConfig()?.messages?.unsavedChanges ??
        'Discard unsaved changes?';
      if (!confirm(msg)) {
        e.preventDefault();
      }
    }
  };
  dialog.addEventListener('cancel', onCancel);

  const onClose = () => {
    const previousOpener = openers.get(dialog);
    if (previousOpener && document.body.contains(previousOpener)) {
      previousOpener.focus();
    }
    openers.delete(dialog);
  };
  dialog.addEventListener('close', onClose);

  const cleanup = () => {
    dialog.removeEventListener('cancel', onCancel);
    dialog.removeEventListener('close', onClose);
    dialog.removeAttribute('data-flux-close-wired');
    dialogControllers.delete(dialog);
    activeDialogDisposers.delete(cleanup);
  };

  dialogControllers.set(dialog, cleanup);
  activeDialogDisposers.add(cleanup);
  dialog.setAttribute('data-flux-close-wired', '1');
}

/** Installs the fx-open, fx-close, and fx-confirm-dialog delegation. Returns a teardown for tests. */
export function installOpenController(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onClick = (evt: Event) => {
    const targetEl = evt.target as HTMLElement | null;
    if (!targetEl) return;

    if (
      targetEl.tagName === 'DIALOG' &&
      (targetEl.hasAttribute('fx-modal') || targetEl.hasAttribute('fx-drawer'))
    ) {
      const dialog = targetEl as HTMLDialogElement;
      wireDialogControllers(dialog);
      const me = evt as MouseEvent;
      if (me.detail === 0) return; // keyboard/synthetic activation: (0,0) is not "outside"

      // If author declared closedby ("none", "closerequest", or "any"), Flux steps aside
      // completely and lets the native platform handle (or block) dismissal.
      const declaredClosedBy = dialog.getAttribute('closedby');
      if (declaredClosedBy) return;

      const rect = dialog.getBoundingClientRect();
      const inside =
        rect.top <= me.clientY &&
        me.clientY <= rect.top + rect.height &&
        rect.left <= me.clientX &&
        me.clientX <= rect.left + rect.width;
      if (!inside && dialog.open) {
        // requestClose() fires a cancel event first so the dirty-form guard has a
        // chance to intercept; for older engines without requestClose, dispatching
        // cancelable cancel manually guarantees the exact same guard runs.
        const dialogWithReq = dialog as unknown as { requestClose?: () => void };
        if (typeof dialogWithReq.requestClose === 'function') {
          dialogWithReq.requestClose();
        } else {
          const cancelEvt = new CustomEvent('cancel', { cancelable: true });
          dialog.dispatchEvent(cancelEvt);
          if (!cancelEvt.defaultPrevented) {
            dialog.close();
          }
        }
      }
      // backdrop click must not also trigger fx-open beneath it
      if (!inside) return;
    }

    // Handle fx-open. An empty value must not short-circuit the handler: the fx-close
    // handling below still needs to run for clicks inside this element.
    const openTarget = targetEl.closest(`[${OPEN_ATTR}]`);
    if (openTarget instanceof Element) {
      const selector = openTarget.getAttribute(OPEN_ATTR);
      if (selector) {
        const el = safeQuerySelector(selector);
        if (el instanceof HTMLDialogElement) {
          if (!openers.has(el)) {
            const opener = (document.activeElement as HTMLElement) ?? (openTarget as HTMLElement);
            openers.set(el, opener);
          }

          if (!el.open && typeof el.showModal === 'function') {
            el.showModal();
          }

          wireDialogControllers(el);
          // Move focus into the dialog for keyboard users.
          const focusable = el.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          focusable?.focus();
          evt.preventDefault();
          return;
        } else if (el instanceof HTMLElement && el.hasAttribute('popover')) {
          // showPopover exists on every modern HTMLElement but THROWS InvalidStateError
          // unless the element actually declares the popover attribute.
          const opener = (document.activeElement as HTMLElement) ?? (openTarget as HTMLElement);
          if (!openers.has(el as unknown as HTMLDialogElement)) {
            openers.set(el as unknown as HTMLDialogElement, opener);
          }
          try {
            if (!el.matches(':popover-open')) el.showPopover();
          } catch {
            /* already open (or :popover-open unsupported) — treat as open */
          }
          evt.preventDefault();
          return;
        } else if (selector) {
          log.warn(
            `[flux] fx-open="${selector}" — target must be a <dialog> or declare the popover attribute`,
          );
        }
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
    const detail = (evt as CustomEvent).detail;
    const elt = (detail?.ctx?.sourceElement ?? detail?.elt) as Element | undefined;
    if (!elt) return;

    // validation.ts already prevented + dropped this request (invalid form); showing
    // the dialog would let issueRequest(true) submit an invalid form.
    if (detail?.ctx?.fluxValidationDropped) return;

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
        activeConfirmationsList.delete(state);
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

      const state = { dialog, cleanup, dropRequest: detail.dropRequest };
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
