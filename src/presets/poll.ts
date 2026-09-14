import { setGeneratedAttribute, removeGeneratedAttribute } from '../core/generated-attributes.js';
import htmx from 'htmx.org';
import { resolveHtmx, type HtmxGlobal } from '../core/startup.js';

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
  interface WindowWithHtmx {
    htmx?: Loose;
  }
  const win = window as unknown as WindowWithHtmx;
  const api = (): Loose | undefined => {
    const h = resolveHtmx(htmx as unknown as HtmxGlobal);
    return (h as unknown as Loose) ?? win.htmx;
  };

  const onVisibility = () => {
    const htmxInstance = api();
    const hidden = document.visibilityState === 'hidden';
    for (const el of document.querySelectorAll<HTMLElement>('[data-flux-preset="poll"]')) {
      const trigger = el.getAttribute('hx-trigger') ?? '';
      if (hidden) {
        if (trigger && trigger !== 'none') {
          el.dataset.fluxPollTrigger = trigger;
          // registry-aware; hx-get is untouched — the URL can never be lost.
          // 'none' fires never, and hx-get stays so nothing else changes meaning.
          setGeneratedAttribute(el, 'hx-trigger', 'none');
          htmxInstance?.process?.(el);
        }
      } else if (el.dataset.fluxPollTrigger) {
        setGeneratedAttribute(el, 'hx-trigger', el.dataset.fluxPollTrigger);
        delete el.dataset.fluxPollTrigger;
        htmxInstance?.process?.(el);
        const url = el.getAttribute('hx-get');
        if (url && htmxInstance?.ajax) void htmxInstance.ajax('GET', url, { source: el });
      }
    }
  };

    document.addEventListener('visibilitychange', onVisibility);
  return () => document.removeEventListener('visibilitychange', onVisibility);
}
