// Action Pipeline
// Executes declarative actions defined in fx-on-success, fx-on-error, etc.

import { queryMany } from './selectors.js';
import { cache } from '../cache/instance.js';
import { showBuiltInToast } from './feedback.js';

export type ActionHandler = (
  targetArg: string,
  sourceElement: Element,
  eventDetail?: any,
) => void | Promise<void>;

const actionHandlers = new Map<string, ActionHandler>();

/** Registers a custom action handler and returns an ownership-safe unregister function. */
export function registerAction(name: string, handler: ActionHandler): () => void {
  const previous = actionHandlers.get(name);
  actionHandlers.set(name, handler);
  return () => {
    if (actionHandlers.get(name) !== handler) return;
    if (previous) actionHandlers.set(name, previous);
    else actionHandlers.delete(name);
  };
}

/** Parses and executes a single action string (e.g. "close:#modal" or "reset") */
export async function executeAction(
  actionString: string,
  sourceElement: Element,
  eventDetail?: any,
): Promise<void> {
  const parts = actionString.trim().split(':');
  const actionName = parts.shift()?.trim();
  if (!actionName) return;

  const targetArg = parts.join(':').trim(); // Rejoin the rest in case target has colons

  const handler = actionHandlers.get(actionName);
  if (handler) {
    await handler(targetArg, sourceElement, eventDetail);
  } else {
    console.warn(`[flux] Unknown action: "${actionName}"`);
  }
}

/** Parses a semicolon-separated list of actions and executes them sequentially. */
export async function executePipeline(
  pipelineString: string,
  sourceElement: Element,
  eventDetail?: any,
): Promise<void> {
  const actions = pipelineString
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const action of actions) {
    try {
      await executeAction(action, sourceElement, eventDetail);
    } catch (err) {
      console.warn(`[flux] Action "${action}" failed:`, err);
      sourceElement.dispatchEvent(
        new CustomEvent('flux:action:error', { bubbles: true, detail: { action, error: err } }),
      );
    }
  }
}

// -- Built-in Actions --

registerAction('close', (targetArg, source) => {
  const targets = targetArg
    ? queryMany(targetArg, source.ownerDocument)
    : [source.closest('dialog')];
  targets.forEach((t) => {
    if (t && typeof (t as any).close === 'function') (t as any).close();
    else if (t) t.removeAttribute('open');
  });
});

registerAction('open', (targetArg, source) => {
  if (!targetArg) return;
  const targets = queryMany(targetArg, source.ownerDocument);
  targets.forEach((t) => {
    if (t instanceof HTMLDialogElement) t.showModal();
    else t.setAttribute('open', '');
  });
});

registerAction('reset', (targetArg, source) => {
  const targets = targetArg ? queryMany(targetArg, source.ownerDocument) : [source.closest('form')];
  targets.forEach((t) => {
    if (t instanceof HTMLFormElement) t.reset();
  });
});

registerAction('refresh', (targetArg, source) => {
  const targets = targetArg ? queryMany(targetArg, source.ownerDocument) : [source];
  const activeHtmx = (window as any).htmx;
  targets.forEach((t) => {
    if (typeof activeHtmx?.trigger === 'function') {
      activeHtmx.trigger(t, 'refresh');
    } else {
      t.dispatchEvent(new CustomEvent('flux:refresh', { bubbles: true }));
    }
  });
});

registerAction('remove', (targetArg, source) => {
  const targets = targetArg ? queryMany(targetArg, source.ownerDocument) : [source];
  targets.forEach((t) => t.remove());
});

registerAction('toast', (targetArg, _source) => {
  showBuiltInToast(targetArg, 'success');
  // Optional: still fire the event if anything else listens to it
  document.dispatchEvent(
    new CustomEvent('flux:toast', { detail: { message: targetArg, type: 'success' } }),
  );
});

registerAction('invalidate', (pattern) => {
  if (!pattern) return;
  if (pattern.includes('*')) cache.invalidateMatching(pattern);
  else cache.invalidate(pattern);
});

/**
 * Server-driven actions: htmx dispatches events from the HX-Trigger response header,
 * so a server can run any client pipeline —
 *   HX-Trigger: {"flux:action": "toast:Saved; close:#edit; invalidate:GET:/containers*"}
 */
export function installServerActions(): () => void {
  if (typeof document === 'undefined') return () => {};
  const onServerAction = (evt: Event) => {
    const detail = (evt as CustomEvent).detail as unknown;
    const pipeline =
      typeof detail === 'string'
        ? detail
        : ((detail as { actions?: unknown })?.actions ??
          (detail as { pipeline?: unknown })?.pipeline);
    if (typeof pipeline === 'string' && pipeline.trim()) {
      void executePipeline(pipeline, document.body, detail);
    }
  };
  document.addEventListener('flux:action', onServerAction);
  return () => document.removeEventListener('flux:action', onServerAction);
}

// We can add more built-ins as needed (add-class, remove-class, focus, etc.)
