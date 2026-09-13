// Flux Optimistic UI + Automatic Rollback Plugin: @flux/plugin-optimistic
// Instantly updates UI before the request completes and automatically rolls back DOM
// state on failure — rollback is the default, not an opt-in.

import type { FluxPlugin, FluxPluginApi } from '../core/plugin.js';
import { getRequestContext } from '../core/events.js';
import { queryOne, safeClosest } from '../core/selectors.js';

interface OptimisticSnapshot {
  target: Element;
  parent: Node | null;
  nextSibling: Node | null;
  addedClass?: string;
  hadClassBefore: boolean;
  removed: boolean;
}

interface PendingSnapshot {
  snapshot: OptimisticSnapshot;
  onResponse: EventListener;
}

const activeSnapshots = new Map<Element, PendingSnapshot>();

function resolveOptimisticTarget(trigger: Element, removeSelector: string): Element | null {
  if (removeSelector === 'this' || removeSelector === 'self') return trigger;
  if (removeSelector.startsWith('closest ')) {
    const tag = removeSelector.replace('closest ', '').trim();
    return safeClosest(trigger, tag);
  }
  return queryOne(removeSelector, document);
}

function restoreSnapshot(snapshot: OptimisticSnapshot): void {
  if (snapshot.removed && snapshot.parent) {
    if (snapshot.nextSibling && snapshot.parent.contains(snapshot.nextSibling)) {
      snapshot.parent.insertBefore(snapshot.target, snapshot.nextSibling);
    } else {
      snapshot.parent.appendChild(snapshot.target);
    }
  } else if (snapshot.addedClass && !snapshot.hadClassBefore) {
    snapshot.target.classList.remove(snapshot.addedClass);
  }
}

export const optimisticPlugin: FluxPlugin = {
  name: 'optimistic-ui',
  setup(_api: FluxPluginApi) {
    if (typeof document === 'undefined') return;

    // The response listener lives ON the source element, not the document: when the
    // optimistically removed subtree contains the source, htmx dispatches the response
    // event on a detached node — bubbling can never reach document listeners.
    const onResponse = (evt: Event) => {
      const source = evt.currentTarget as Element | null;
      if (!source) return;
      const pending = activeSnapshots.get(source);
      if (!pending) return;

      source.removeEventListener('htmx:after:request', pending.onResponse);
      activeSnapshots.delete(source);

      if (getRequestContext(evt).successful) {
        // Success: finalize the optimistic UI mutation.
        return;
      }

      // Failure: automatic rollback (default behaviour).
      restoreSnapshot(pending.snapshot);
      source.dispatchEvent(
        new CustomEvent('flux:optimistic:rollback', {
          bubbles: true,
          detail: { target: pending.snapshot.target },
        }),
      );
    };

    const onRequest = (evt: Event) => {
      const ctx = getRequestContext(evt);
      // Key snapshots by the request SOURCE: when the trigger is an ancestor found via
      // closest(), the response event still reports the same source element.
      const source = ctx.source;
      if (!source || activeSnapshots.has(source)) return;

      const trigger = source.closest('[fx-optimistic-remove], [fx-optimistic-class]') ?? source;
      const removeSelector = trigger.getAttribute('fx-optimistic-remove');
      const addClass = trigger.getAttribute('fx-optimistic-class');

      if (!removeSelector && !addClass) return;

      const target = removeSelector ? resolveOptimisticTarget(trigger, removeSelector) : trigger;
      if (!target) return;

      const snapshot: OptimisticSnapshot = {
        target,
        parent: target.parentNode,
        nextSibling: target.nextSibling,
        addedClass: addClass ?? undefined,
        hadClassBefore: addClass ? target.classList.contains(addClass) : false,
        removed: Boolean(removeSelector),
      };

      const onResponseForSource: EventListener = onResponse;
      activeSnapshots.set(source, { snapshot, onResponse: onResponseForSource });
      source.addEventListener('htmx:after:request', onResponseForSource);

      // Perform the immediate optimistic mutation.
      if (snapshot.removed) {
        target.remove();
      } else if (snapshot.addedClass) {
        target.classList.add(snapshot.addedClass);
      }
    };

    document.addEventListener('htmx:before:request', onRequest);

    return () => {
      document.removeEventListener('htmx:before:request', onRequest);
      // Clean teardown: restore any pending optimistic DOM elements.
      for (const [source, pending] of Array.from(activeSnapshots.entries())) {
        source.removeEventListener('htmx:after:request', pending.onResponse);
        restoreSnapshot(pending.snapshot);
        activeSnapshots.delete(source);
      }
    };
  },
};
