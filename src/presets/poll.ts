import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';

export interface PollOptions {
  url: string;
  interval: string;
  target?: string;
  indicator?: string;
}

export function applyPoll(element: Element, options: PollOptions): boolean {
  if (
    !(element instanceof HTMLElement) ||
    !options.url ||
    !options.url.trim() ||
    !options.interval
  ) {
    return false;
  }

  const interval = normalizeInterval(options.interval);
  const sig = JSON.stringify({
    url: options.url,
    interval,
    target: options.target,
    indicator: options.indicator,
  });
  if (
    element.getAttribute('data-flux-preset') === 'poll' &&
    element.getAttribute('data-flux-preset-signature') === sig
  ) {
    return false;
  }

  setGeneratedAttribute(element, 'hx-get', options.url);
  setGeneratedAttribute(element, 'hx-trigger', `every ${interval}`);
  setGeneratedAttribute(element, 'hx-sync', 'this:replace');

  syncOptionalAttribute(element, 'hx-target', options.target);
  syncOptionalAttribute(element, 'hx-indicator', options.indicator);

  element.setAttribute('data-flux-preset', 'poll');
  element.setAttribute('data-flux-preset-signature', sig);

  return true;
}

function syncOptionalAttribute(element: Element, name: string, value?: string): void {
  if (value && value.trim()) {
    setGeneratedAttribute(element, name, value);
  } else {
    removeGeneratedAttribute(element, name);
  }
}

function normalizeInterval(value: string): string {
  const trimmed = value.trim();
  return /^\d+$/.test(trimmed) ? `${trimmed}ms` : trimmed;
}

/**
 * Pauses `every`-style polling while the tab is hidden (htmx 4 has no built-in
 * pause and no public API to cancel poll timers). Mechanism: htmx.process tears
 * down and re-wires an element's trigger specs, so we swap the generated
 * hx-trigger attribute and reprocess. On return to visibility the element fires
 * once immediately, then its timer restarts.
 */
export function installPollVisibilityPause(): () => void {
  if (typeof document === 'undefined') return () => {};
  type Loose = {
    ajax?: (m: string, u: string, ctx?: unknown) => unknown;
    process?: (el: Element) => void;
  };
  const api = (): Loose | undefined =>
    (window as { htmx?: Loose }).htmx ?? (globalThis as { htmx?: Loose }).htmx;

  const onVisibility = () => {
    const htmx = api();
    if (!htmx?.process) return;
    const hidden = document.visibilityState === 'hidden';
    for (const el of document.querySelectorAll<HTMLElement>('[data-flux-preset="poll"]')) {
      const trigger = el.getAttribute('hx-trigger') ?? '';
      if (hidden) {
        if (trigger) {
          el.dataset.fluxPollTrigger = trigger;
          // registry-aware: pause = drop polling trigger AND the verb, so the
          // element is completely inert (no default-click requests either)
          removeGeneratedAttribute(el, 'hx-get');
          removeGeneratedAttribute(el, 'hx-trigger');
          htmx.process(el);
        }
      } else if (el.dataset.fluxPollTrigger) {
        setGeneratedAttribute(el, 'hx-get', el.getAttribute('data-flux-poll-url') ?? '');
        setGeneratedAttribute(el, 'hx-trigger', el.dataset.fluxPollTrigger);
        delete el.dataset.fluxPollTrigger;
        htmx.process(el);
      }
    }
  };

  document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}
