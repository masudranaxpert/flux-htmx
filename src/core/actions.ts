// Action Pipeline
// Executes declarative actions defined in fx-on-success, fx-on-error, etc.

import { queryMany } from './selectors.js';
import { showBuiltInToast } from './feedback.js';

export type ActionHandler = (targetArg: string, sourceElement: Element, eventDetail?: any) => void | Promise<void>;

const actionHandlers = new Map<string, ActionHandler>();
const namedActionPipelines = new Map<string, string[]>();

/** Registers a custom action handler. */
export function registerAction(name: string, handler: ActionHandler): void {
  actionHandlers.set(name, handler);
}

/** Registers a reusable pipeline of actions under a name. */
export function defineActionPipeline(name: string, pipeline: string[] | string): void {
  const steps = Array.isArray(pipeline) ? pipeline : pipeline.split(';').map(s => s.trim()).filter(Boolean);
  namedActionPipelines.set(name, steps);
}

/** Executes a named pipeline */
export async function executeNamedPipeline(name: string, sourceElement: Element, eventDetail?: any): Promise<void> {
  const pipeline = namedActionPipelines.get(name);
  if (pipeline) {
    for (const action of pipeline) {
      await executeAction(action, sourceElement, eventDetail);
    }
  } else {
    console.warn(`[flux] Unknown action pipeline: "${name}"`);
  }
}

/** Parses and executes a single action string (e.g. "close:#modal" or "reset") */
export async function executeAction(actionString: string, sourceElement: Element, eventDetail?: any): Promise<void> {
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
export async function executePipeline(pipelineString: string, sourceElement: Element, eventDetail?: any): Promise<void> {
  const actions = pipelineString.split(';').map(s => s.trim()).filter(Boolean);
  for (const action of actions) {
    try {
      await executeAction(action, sourceElement, eventDetail);
    } catch (err) {
      console.warn(`[flux] Action "${action}" failed:`, err);
      sourceElement.dispatchEvent(new CustomEvent('flux:action:error', { bubbles: true, detail: { action, error: err } }));
    }
  }
}

// -- Built-in Actions --

registerAction('close', (targetArg, source) => {
  const targets = targetArg ? queryMany(targetArg, source.ownerDocument) : [source.closest('dialog')];
  targets.forEach(t => {
    if (t && typeof (t as any).close === 'function') (t as any).close();
    else if (t) t.removeAttribute('open');
  });
});

registerAction('open', (targetArg, source) => {
  if (!targetArg) return;
  const targets = queryMany(targetArg, source.ownerDocument);
  targets.forEach(t => {
    if (t instanceof HTMLDialogElement) t.showModal();
    else t.setAttribute('open', '');
  });
});

registerAction('reset', (targetArg, source) => {
  const targets = targetArg ? queryMany(targetArg, source.ownerDocument) : [source.closest('form')];
  targets.forEach(t => {
    if (t instanceof HTMLFormElement) t.reset();
  });
});

registerAction('refresh', (targetArg, source) => {
  const targets = targetArg ? queryMany(targetArg, source.ownerDocument) : [source];
  const activeHtmx = (window as any).htmx;
  targets.forEach(t => {
    if (typeof activeHtmx?.trigger === 'function') {
      activeHtmx.trigger(t, 'refresh');
    } else {
      t.dispatchEvent(new CustomEvent('flux:refresh', { bubbles: true }));
    }
  });
});

registerAction('remove', (targetArg, source) => {
  const targets = targetArg ? queryMany(targetArg, source.ownerDocument) : [source];
  targets.forEach(t => t.remove());
});

registerAction('toast', (targetArg, source) => {
  showBuiltInToast(targetArg, 'success');
  // Optional: still fire the event if anything else listens to it
  document.dispatchEvent(new CustomEvent('flux:toast', { detail: { message: targetArg, type: 'success' } }));
});

// We can add more built-ins as needed (add-class, remove-class, focus, etc.)
