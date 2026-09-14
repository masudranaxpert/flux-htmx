// Visibility and self-removal presets. One visibility mechanism throughout: the
// `hidden` class (Tailwind-compatible, synchronous, no inline styles). fx-show,
// fx-hide, fx-toggle, fx-hide-escape, fx-hide-outside, and fx-dropdown all read and
// write the same class, so any combination composes — a panel hidden by fx-hide can
// be shown again by fx-toggle.
//
// Every controller registers a disconnect so signature changes and element teardown
// remove the previous listeners instead of stacking them.

import { queryMany } from '../core/selectors.js';
import { log } from '../core/logger.js';

const HIDDEN_CLASS = 'hidden';

/** Resolves a preset target selector; `this`/omitted means the trigger element itself. */
function resolveTargets(targetSelector: string | undefined, element: Element): Element[] {
  if (targetSelector && targetSelector !== 'this') {
    return queryMany(targetSelector);
  }
  return [element];
}

interface UiListenerController {
  listener: EventListener;
}

const uiListeners = new WeakMap<Element, UiListenerController>();

function connectUiListener(
  element: Element,
  listener: EventListener,
  previous: UiListenerController | undefined,
): void {
  if (previous) element.removeEventListener('click', previous.listener);
  element.addEventListener('click', listener);
  uiListeners.set(element, { listener });
}

function disconnectUiListener(element: Element): void {
  const controller = uiListeners.get(element);
  if (!controller) return;
  element.removeEventListener('click', controller.listener);
  uiListeners.delete(element);
}

/** fx-show: removes the `hidden` class from the target on click. */
export function applyShow(element: Element, targetSelector?: string): boolean {
  connectUiListener(
    element,
    () => {
      for (const t of resolveTargets(targetSelector, element)) t.classList.remove(HIDDEN_CLASS);
    },
    uiListeners.get(element),
  );
  return true;
}

export function disconnectShow(element: Element): void {
  disconnectUiListener(element);
}

/** fx-hide: adds the `hidden` class to the target on click. */
export function applyHide(element: Element, targetSelector?: string): boolean {
  connectUiListener(
    element,
    () => {
      for (const t of resolveTargets(targetSelector, element)) t.classList.add(HIDDEN_CLASS);
    },
    uiListeners.get(element),
  );
  return true;
}

export function disconnectHide(element: Element): void {
  disconnectUiListener(element);
}

/** fx-toggle: toggles the `hidden` class on the target on click. */
export function applyToggle(element: Element, targetSelector?: string): boolean {
  connectUiListener(
    element,
    () => {
      for (const t of resolveTargets(targetSelector, element)) t.classList.toggle(HIDDEN_CLASS);
    },
    uiListeners.get(element),
  );
  return true;
}

export function disconnectToggle(element: Element): void {
  disconnectUiListener(element);
}

/** fx-class="name": toggles an arbitrary class on the target on click. */
export function applyClassToggle(
  element: Element,
  className: string,
  targetSelector?: string,
): boolean {
  if (!className) return false;
  connectUiListener(
    element,
    () => {
      for (const t of resolveTargets(targetSelector, element)) t.classList.toggle(className);
    },
    uiListeners.get(element),
  );
  return true;
}

export function disconnectClassToggle(element: Element): void {
  disconnectUiListener(element);
}

/** Parses `fx-remove`'s duration ("500", "500ms", "2s"). Returns null when unparseable. */
function parseRemoveDelayMs(delayStr: string): number | null {
  const raw = delayStr.trim();
  if (!raw) return null;
  let ms: number;
  if (raw.endsWith('ms')) {
    ms = parseInt(raw, 10);
  } else if (raw.endsWith('s')) {
    ms = parseFloat(raw) * 1000;
  } else {
    ms = parseInt(raw, 10);
  }
  if (Number.isNaN(ms) || ms < 0) return null;
  return ms;
}

/**
 * fx-remove="3s": removes the element itself after a delay. The value MUST be a
 * duration — a non-duration value (e.g. the `closest li` used by fx-delete's
 * fx-remove-target) disables self-removal instead of destroying the element on load.
 */
export function applyRemove(element: Element, delayStr: string): boolean {
  const ms = parseRemoveDelayMs(delayStr);
  if (ms === null) {
    log.warn(
      `fx-remove="${delayStr}" is not a duration; ignoring. ` +
        `To remove an ancestor after fx-delete succeeds, use fx-remove-target.`,
    );
    return false;
  }
  const remove = () => {
    if (element.isConnected) element.remove();
  };
  if (ms > 0) {
    setTimeout(remove, ms);
  } else {
    remove();
  }
  return true;
}

interface DocumentListenerController {
  listener: EventListener;
  arm?: ReturnType<typeof setTimeout>;
}

const escapeListeners = new WeakMap<Element, DocumentListenerController>();

/** fx-hide-escape: closes the target (adds `hidden`) when Escape is pressed. */
export function applyHideEscape(element: Element, targetSelector?: string): boolean {
  disconnectHideEscape(element);
  const listener = (e: Event) => {
    if ((e as KeyboardEvent).key !== 'Escape') return;
    for (const el of resolveTargets(targetSelector, element)) {
      if (!el.classList.contains(HIDDEN_CLASS)) el.classList.add(HIDDEN_CLASS);
    }
  };
  document.addEventListener('keydown', listener);
  escapeListeners.set(element, { listener });
  return true;
}

export function disconnectHideEscape(element: Element): void {
  const controller = escapeListeners.get(element);
  if (!controller) return;
  document.removeEventListener('keydown', controller.listener);
  escapeListeners.delete(element);
}

const outsideListeners = new WeakMap<Element, { cancel: () => void }>();

/**
 * fx-hide-outside: closes the target when a click lands outside the trigger.
 * The document listener attaches after a 100 ms grace period; `cancelled` guards
 * the race where disconnect runs before the listener was attached.
 */
export function applyHideOutside(element: Element, targetSelector?: string): boolean {
  disconnectHideOutside(element);
  let cancelled = false;
  const listener = (e: Event) => {
    if (cancelled) return;
    if (element.contains(e.target as Node)) return;
    for (const el of resolveTargets(targetSelector, element)) {
      if (!el.classList.contains(HIDDEN_CLASS)) el.classList.add(HIDDEN_CLASS);
    }
  };
  const arm = setTimeout(() => {
    if (!cancelled) document.addEventListener('click', listener);
  }, 100);
  outsideListeners.set(element, {
    cancel: () => {
      cancelled = true;
      clearTimeout(arm);
      document.removeEventListener('click', listener);
    },
  });
  return true;
}

export function disconnectHideOutside(element: Element): void {
  outsideListeners.get(element)?.cancel();
  outsideListeners.delete(element);
}
// Coordinated dropdown controller: toggle + outside-click + Escape close in one synchronous
// handler. Toggles the `hidden` class instantly and excludes the trigger from outside-close,
// so no setTimeout deferral is needed to keep the opening click safe.

interface DropdownController {
  triggerClick: EventListener;
  outsideClick: EventListener;
  escapeKey: EventListener;
}

const dropdownControllers = new WeakMap<Element, DropdownController>();

export function applyDropdown(element: Element, targetSelector?: string): boolean {
  disconnectDropdown(element);
  const trigger = element;

  const targets = (): Element[] => {
    if (targetSelector && targetSelector !== 'this') {
      return queryMany(targetSelector);
    }
    return [trigger];
  };

  const sync = (open: boolean) => {
    trigger.setAttribute('aria-expanded', String(open));
  };

  const open = () => {
    targets().forEach((t) => t.classList.remove(HIDDEN_CLASS));
    sync(true);
  };

  const close = () => {
    targets().forEach((t) => t.classList.add(HIDDEN_CLASS));
    sync(false);
  };

  const triggerClick = () => {
    // Synchronous class toggle: nothing can race the outside-close below.
    if (targets().some((t) => !t.classList.contains(HIDDEN_CLASS))) {
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
  sync(targets().some((t) => !t.classList.contains(HIDDEN_CLASS)));
  dropdownControllers.set(trigger, { triggerClick, outsideClick, escapeKey });
  return true;
}

export function disconnectDropdown(element: Element): void {
  const c = dropdownControllers.get(element);
  if (!c) return;
  element.removeEventListener('click', c.triggerClick);
  document.removeEventListener('click', c.outsideClick);
  document.removeEventListener('keydown', c.escapeKey);
  dropdownControllers.delete(element);
}

const hiddenGuardWarned = new WeakSet<Element>();

/**
 * Dev-mode safety net: Flux's visibility layer drives the `hidden` class. If no CSS
 * defines it (no Tailwind, flux.css not loaded), hide actions silently no-op. Warn
 * once per element instead of failing silently.
 */
export function installHiddenClassGuard(): () => void {
  if (typeof document === 'undefined') return () => {};
  const dev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV !== false && (import.meta as { env?: { PROD?: boolean } }).env?.PROD !== true;
  if (!dev) return () => {};
  const onAbort = (evt: Event) => {
    const el = evt.target as Element | null;
    if (
      !el ||
      !(evt as CustomEvent).detail?.fluxHiddenGuard ||
      hiddenGuardWarned.has(el) ||
      typeof getComputedStyle !== 'function'
    ) {
      return;
    }
    if (el.classList.contains('hidden') && getComputedStyle(el as HTMLElement).display !== 'none') {
      hiddenGuardWarned.add(el);
       
      console.warn(
        '[flux] fx-hide ran but the element is still visible. Flux uses the `hidden` ' +
          'class; add `.hidden{display:none}` to your CSS or load flux.css.',
      );
    }
  };
  document.addEventListener('flux:hidden-guard', onAbort);
  const onClickCapture = (evt: Event) => {
    const trigger = (evt.target as HTMLElement | null)?.closest(
      '[fx-hide],[fx-toggle],[fx-dropdown],[fx-hide-outside],[fx-hide-escape]',
    );
    if (!trigger) return;
    // evaluate after the action handler ran
    setTimeout(() => {
      const sel =
        trigger.getAttribute('fx-hide') ||
        trigger.getAttribute('fx-toggle') ||
        trigger.getAttribute('fx-dropdown') ||
        trigger.getAttribute('fx-hide-outside') ||
        trigger.getAttribute('fx-hide-escape');
      const targets: Element[] = [];
      if (sel && sel !== 'this' && !trigger.hasAttribute('fx-toggle')) {
        try {
          targets.push(...Array.from(document.querySelectorAll(sel)));
        } catch {
          /* invalid */
        }
      } else {
        targets.push(trigger);
      }
      for (const el of targets) {
        if (el.classList.contains('hidden')) {
          el.dispatchEvent(
            new CustomEvent('flux:hidden-guard', {
              detail: { fluxHiddenGuard: true },
              bubbles: false,
            }),
          );
        }
      }
    }, 0);
  };
  document.addEventListener('click', onClickCapture, true);
  return () => {
    document.removeEventListener('flux:hidden-guard', onAbort);
    document.removeEventListener('click', onClickCapture, true);
  };
}
