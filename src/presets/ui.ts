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

export function applyClassToggle(
  element: Element,
  className: string,
  targetSelector?: string,
): boolean {
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
      const target =
        targetSelector && targetSelector !== 'this' ? any(targetSelector) : me(element);
      if (!target) return;

      const nodes = Array.isArray(target) ? target : [target];
      nodes.forEach((n) => {
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
    const target = targetSelector && targetSelector !== 'this' ? any(targetSelector) : me(element);
    if (!target) return;

    // If click is outside the specified element, hide the target
    if (!element.contains(e.target as Node)) {
      const nodes = Array.isArray(target) ? target : [target];
      nodes.forEach((n) => {
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

// Coordinated dropdown controller: toggle + outside-click + Escape close in one synchronous
// handler. Unlike fx-show/fx-hide-outside (which race via async fades on a shared click),
// this toggles the `hidden` class instantly and excludes the trigger from outside-close.
interface DropdownController {
  triggerClick: EventListener;
  outsideClick: EventListener;
  escapeKey: EventListener;
}

const dropdownControllers = new WeakMap<Element, DropdownController>();

export function applyDropdown(element: Element, targetSelector?: string): boolean {
  const trigger = element;

  const targets = (): Element[] => {
    if (targetSelector && targetSelector !== 'this') {
      return Array.from(document.querySelectorAll(targetSelector));
    }
    return [trigger];
  };

  const sync = (open: boolean) => {
    trigger.setAttribute('aria-expanded', String(open));
  };

  const open = () => {
    targets().forEach((t) => t.classList.remove('hidden'));
    sync(true);
  };

  const close = () => {
    targets().forEach((t) => t.classList.add('hidden'));
    sync(false);
  };

  const triggerClick = () => {
    // Synchronous class toggle: no async fade, so nothing can race the outside-close below.
    if (targets().some((t) => !t.classList.contains('hidden'))) {
      close();
    } else {
      open();
    }
  };

  const outsideClick = (e: Event) => {
    const node = e.target as Node | null;
    // The trigger toggles itself; clicks inside any target keep it open. Excluding the
    // trigger here is what makes the opening click safe — no setTimeout deferral needed.
    if (!node || trigger.contains(node) || targets().some((t) => t.contains(node))) return;
    close();
  };

  const escapeKey = (e: Event) => {
    if ((e as KeyboardEvent).key === 'Escape') close();
  };

  trigger.addEventListener('click', triggerClick);
  document.addEventListener('click', outsideClick);
  document.addEventListener('keydown', escapeKey);
  sync(targets().some((t) => !t.classList.contains('hidden')));
  dropdownControllers.set(trigger, { triggerClick, outsideClick, escapeKey });
  return true;
}

export function disconnectDropdown(element: Element) {
  const c = dropdownControllers.get(element);
  if (!c) return;
  element.removeEventListener('click', c.triggerClick);
  document.removeEventListener('click', c.outsideClick);
  document.removeEventListener('keydown', c.escapeKey);
  dropdownControllers.delete(element);
}
