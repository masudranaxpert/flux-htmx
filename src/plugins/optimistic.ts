// Flux Optimistic UI + Automatic Rollback Plugin: @flux/plugin-optimistic
// Instantly updates UI before request completes and automatically rolls back DOM state on failure.

import type { FluxPlugin, FluxPluginApi } from '../core/plugin.js';
import { getRequestContext } from '../core/events.js';
import { queryOne, safeClosest } from '../core/selectors.js';

interface OptimisticSnapshot {
  source: Element;
  target: Element;
  parent: Node | null;
  nextSibling: Node | null;
  displayStyle: string;
  addedClass?: string;
  hadClassBefore: boolean;
  removed: boolean;
  rollbackOptIn: boolean;
}

const activeSnapshots = new Map<Element, OptimisticSnapshot>();

export const optimisticPlugin: FluxPlugin = {
  name: 'optimistic-ui',
  setup(_api: FluxPluginApi) {
    if (typeof document === 'undefined') return;

    const onRequest = (evt: Event) => {
      const targetEl = evt.target as Element;
      if (!targetEl) return;

      const trigger = targetEl.closest('[fx-optimistic-remove], [fx-optimistic-class]') ?? targetEl;
      const removeSelector = trigger.getAttribute('fx-optimistic-remove');
      const addClass = trigger.getAttribute('fx-optimistic-class');

      if (!removeSelector && !addClass) return;

      let target: Element | null = null;
      if (removeSelector) {
        if (removeSelector === 'this' || removeSelector === 'self') {
          target = trigger;
        } else if (removeSelector.startsWith('closest ')) {
          const tag = removeSelector.replace('closest ', '').trim();
          target = safeClosest(trigger, tag);
        } else {
          target = queryOne(removeSelector, document);
        }
      } else {
        target = trigger;
      }

      if (!target || activeSnapshots.has(trigger)) return;

      const hadClassBefore = addClass ? target.classList.contains(addClass) : false;

      const snapshot: OptimisticSnapshot = {
        source: trigger,
        target,
        parent: target.parentNode,
        nextSibling: target.nextSibling,
        displayStyle: (target as HTMLElement).style?.display ?? '',
        addedClass: addClass ?? undefined,
        hadClassBefore,
        removed: Boolean(removeSelector),
        rollbackOptIn: trigger.hasAttribute('fx-rollback'),
      };

      activeSnapshots.set(trigger, snapshot);

      // Perform immediate optimistic mutation
      if (snapshot.removed) {
        target.remove();
      } else if (snapshot.addedClass) {
        target.classList.add(snapshot.addedClass);
      }
    };

    const onResponse = (evt: Event) => {
      const ctx = getRequestContext(evt);
      const source = ctx.source;
      if (!source) return;

      const snapshot = activeSnapshots.get(source);
      if (!snapshot) return;

      if (ctx.successful) {
        // Success: finalize optimistic UI mutation
        activeSnapshots.delete(source);
      } else if (snapshot.rollbackOptIn) {
        // Failure with explicit fx-rollback opt-in: perform automatic rollback
        restoreSnapshot(snapshot);
        activeSnapshots.delete(source);

        source.dispatchEvent(
          new CustomEvent('flux:optimistic:rollback', {
            bubbles: true,
            detail: { target: snapshot.target },
          }),
        );
      } else {
        activeSnapshots.delete(source);
      }
    };

    document.addEventListener('htmx:before:request', onRequest);
    document.addEventListener('htmx:after:request', onResponse);

    return () => {
      document.removeEventListener('htmx:before:request', onRequest);
      document.removeEventListener('htmx:after:request', onResponse);
      // Clean teardown: restore any pending optimistic DOM elements
      for (const [key, snapshot] of Array.from(activeSnapshots.entries())) {
        restoreSnapshot(snapshot);
        activeSnapshots.delete(key);
      }
    };
  },
};

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
