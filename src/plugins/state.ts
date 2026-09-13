import { queryAllSafely } from '../core/selectors.js';

export function installState(): () => void {
  document.addEventListener('click', handleStateClick);
  return () => document.removeEventListener('click', handleStateClick);
}

function handleStateClick(e: MouseEvent) {
  const target = e.target as HTMLElement;

  const toggleBtn = target.closest('[fx-state-toggle]');
  if (toggleBtn) {
    const key = toggleBtn.getAttribute('fx-state-toggle');
    if (key) {
      const container = toggleBtn.closest('[fx-state]') || document.body;
      const current = container.getAttribute(`data-state-${key}`) === 'true';
      setState(container, key, (!current).toString());
    }
    return;
  }

  const setBtn = target.closest('[fx-state-set]');
  if (setBtn) {
    const val = setBtn.getAttribute('fx-state-set');
    if (val && val.includes(':')) {
      const [key, ...rest] = val.split(':');
      const value = rest.join(':');
      const container = setBtn.closest('[fx-state]') || document.body;
      setState(container, key as string, value);
    }
  }
}

function setState(container: Element, key: string, value: string) {
  container.setAttribute(`data-state-${key}`, value);

  // Optionally update classes based on state: fx-class-[key]="value:class"
  const boundElements = queryAllSafely(`[fx-bind-${key}]`, container);
  for (const el of boundElements) {
    const bindExpr = el.getAttribute(`fx-bind-${key}`);
    if (bindExpr) {
      if (bindExpr.includes(':')) {
        // Toggle class based on exact value match e.g., "true:text-green-500"
        const [targetVal, ...classes] = bindExpr.split(':');
        const className = classes.join(':');
        if (value === targetVal) {
          el.classList.add(...className.split(' '));
        } else {
          el.classList.remove(...className.split(' '));
        }
      } else {
        // Simple text interpolation if no colon
        el.textContent = value;
      }
    }
  }
}
