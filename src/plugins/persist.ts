import { queryAllSafely } from '../core/selectors.js';

export function installPersist() {
  document.addEventListener('change', handlePersistChange);

  // Restore on load and on htmx swaps
  document.addEventListener('DOMContentLoaded', () => restorePersisted());
  document.addEventListener('htmx:after:settle', (e: Event) => {
    restorePersisted((e as CustomEvent).detail.el);
  });
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

      // Dispatch event in case other scripts need to know
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}
