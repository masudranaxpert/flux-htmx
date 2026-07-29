// Flux Optimistic UI + Automatic Rollback Plugin: @flux/plugin-optimistic
// Instantly updates UI before request completes and automatically rolls back DOM state on failure.

import type { FluxPlugin, FluxPluginApi } from '../core/plugin.js';
import { getRequestContext } from '../core/events.js';
import { queryOne } from '../core/selectors.js';

interface OptimisticSnapshot {
  target: Element;
  parent: Node | null;
  nextSibling: Node | null;
  displayStyle: string;
  addedClass?: string;
  removed: boolean;
}

const snapshots = new WeakMap<Element, OptimisticSnapshot>();

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
          target = trigger.closest(tag);
        } else {
          target = queryOne(removeSelector, document);
        }
      } else {
        target = trigger;
      }

      if (!target || snapshots.has(trigger)) return;

      const snapshot: OptimisticSnapshot = {
        target,
        parent: target.parentNode,
        nextSibling: target.nextSibling,
        displayStyle: (target as HTMLElement).style?.display ?? '',
        addedClass: addClass ?? undefined,
        removed: Boolean(removeSelector),
      };

      snapshots.set(trigger, snapshot);

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

      const snapshot = snapshots.get(source);
      if (!snapshot) return;

      const shouldRollback = source.hasAttribute('fx-rollback');

      if (ctx.successful) {
        // Success: finalize optimistic UI mutation
        snapshots.delete(source);
      } else if (shouldRollback || !ctx.successful) {
        // Failure: perform automatic rollback to restore original DOM state
        if (snapshot.removed && snapshot.parent) {
          if (snapshot.nextSibling && snapshot.parent.contains(snapshot.nextSibling)) {
            snapshot.parent.insertBefore(snapshot.target, snapshot.nextSibling);
          } else {
            snapshot.parent.appendChild(snapshot.target);
          }
        } else if (snapshot.addedClass) {
          snapshot.target.classList.remove(snapshot.addedClass);
        }

        snapshots.delete(source);

        source.dispatchEvent(
          new CustomEvent('flux:optimistic:rollback', {
            bubbles: true,
            detail: { target: snapshot.target },
          }),
        );
      }
    };

    document.addEventListener('htmx:before:request', onRequest);
    document.addEventListener('htmx:after:request', onResponse);

    return () => {
      document.removeEventListener('htmx:before:request', onRequest);
      document.removeEventListener('htmx:after:request', onResponse);
    };
  },
};
