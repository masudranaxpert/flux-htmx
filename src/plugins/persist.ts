import { queryAllSafely } from '../core/selectors.js';
import { getRequestContext } from '../core/events.js';

/** Runs `fn` now, or on DOMContentLoaded when the document is still loading. */
function onReady(fn: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

export function installPersist(): () => void {
  document.addEventListener('change', handlePersistChange);

  // Restore on load and on htmx swaps. readyState-aware: deferred or dynamic scripts
  // load after DOMContentLoaded has already fired.
  onReady(() => restorePersisted());
  document.addEventListener('htmx:after:settle', handlePersistSettle);
  return () => {
    document.removeEventListener('change', handlePersistChange);
    document.removeEventListener('htmx:after:settle', handlePersistSettle);
  };
}

function handlePersistSettle(e: Event) {
  const ctx = getRequestContext(e);
  const root = ctx.target ?? ctx.source ?? document;
  restorePersisted(root);
}

function handlePersistChange(e: Event) {
  const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  if (!target) return;

  const persistAttr = target.getAttribute('fx-persist');
  if (persistAttr) {
    const key = `fx-persist:${persistAttr}`;
    let value: string;

    if (target.type === 'checkbox') {
      value = (target as HTMLInputElement).checked.toString();
    } else {
      value = target.value;
    }

    localStorage.setItem(key, value);
  }
}

function restorePersisted(root: Element | Document = document) {
  const persistedElements = queryAllSafely('[fx-persist]', root);
  for (const el of persistedElements) {
    const target = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const key = `fx-persist:${target.getAttribute('fx-persist')}`;
    const value = localStorage.getItem(key);

    if (value !== null) {
      if (target.type === 'checkbox') {
        (target as HTMLInputElement).checked = value === 'true';
      } else {
        target.value = value;
      }

      // A synthetic `change` would fire fx-autosave / hx-trigger="change" and send an
      // unintended request on page load. Listeners that care can opt in to this event.
      target.dispatchEvent(new CustomEvent('flux:persist:restored', { bubbles: true }));
    }
  }
}
