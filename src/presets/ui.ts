import { me, any } from '../core/sugar.js';

export function applyShow(element: Element, targetSelector?: string): boolean {
  me(element)?.on('click', () => {
    // any() resolves to an array of nodes; iterate so we call the per-node sugar method,
    // not the array wrapper (which has no fadeIn/fadeOut/classToggle).
    const targets = targetSelector ? any(targetSelector) : any(element);
    targets.forEach((t) => t?.fadeIn());
  });
  return true;
}

export function applyHide(element: Element, targetSelector?: string): boolean {
  me(element)?.on('click', () => {
    const targets = targetSelector ? any(targetSelector) : any(element);
    targets.forEach((t) => t?.fadeOut());
  });
  return true;
}

export function applyToggle(element: Element, targetSelector?: string): boolean {
  me(element)?.on('click', () => {
    const targets = targetSelector ? any(targetSelector) : any(element);
    // Toggle the standard 'hidden' utility class (Tailwind / common CSS).
    targets.forEach((t) => t.classToggle('hidden'));
  });
  return true;
}

export function applyClassToggle(element: Element, className: string, targetSelector?: string): boolean {
  if (!className) return false;
  me(element)?.on('click', () => {
    const targets = targetSelector ? any(targetSelector) : any(element);
    targets.forEach((t) => t.classToggle(className));
  });
  return true;
}

export function applyRemove(element: Element, delayStr: string): boolean {
  let ms = 0;
  if (delayStr) {
    if (delayStr.endsWith('ms')) {
      ms = parseInt(delayStr, 10);
    } else if (delayStr.endsWith('s')) {
      ms = parseFloat(delayStr) * 1000;
    } else {
      ms = parseInt(delayStr, 10);
    }
  }
  
  if (!isNaN(ms) && ms > 0) {
    setTimeout(() => {
      me(element)?.fadeOut(undefined, 500, true);
    }, ms);
  } else {
    me(element)?.fadeOut(undefined, 500, true);
  }
  return true;
}

const escapeListeners = new WeakMap<Element, EventListener>();

export function applyHideEscape(element: Element, targetSelector?: string): boolean {
  const listener = (e: Event) => {
    if ((e as KeyboardEvent).key === 'Escape') {
      const target = (targetSelector && targetSelector !== 'this') ? any(targetSelector) : me(element);
      if (!target) return;
      
      const nodes = Array.isArray(target) ? target : [target];
      nodes.forEach(n => {
        const el = n as unknown as HTMLElement;
        if (el.style.display !== 'none' && !el.classList.contains('hidden')) {
          (me(el) as any).fadeOut();
        }
      });
    }
  };
  document.addEventListener('keydown', listener);
  escapeListeners.set(element, listener);
  return true;
}

export function disconnectHideEscape(element: Element) {
  const listener = escapeListeners.get(element);
  if (listener) {
    document.removeEventListener('keydown', listener);
    escapeListeners.delete(element);
  }
}

const outsideListeners = new WeakMap<Element, EventListener>();

export function applyHideOutside(element: Element, targetSelector?: string): boolean {
  const listener = (e: Event) => {
    const target = (targetSelector && targetSelector !== 'this') ? any(targetSelector) : me(element);
    if (!target) return;
    
    // If click is outside the specified element, hide the target
    if (!element.contains(e.target as Node)) {
      const nodes = Array.isArray(target) ? target : [target];
      nodes.forEach(n => {
        const el = n as unknown as HTMLElement;
        if (el.style.display !== 'none' && !el.classList.contains('hidden')) {
          (me(el) as any).fadeOut();
        }
      });
    }
  };
  // Use a slight delay to avoid instantly closing if a button click triggered the open
  setTimeout(() => {
    document.addEventListener('click', listener);
  }, 100);
  outsideListeners.set(element, listener);
  return true;
}

export function disconnectHideOutside(element: Element) {
  const listener = outsideListeners.get(element);
  if (listener) {
    document.removeEventListener('click', listener);
    outsideListeners.delete(element);
  }
}
