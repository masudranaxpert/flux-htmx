// Status-specific response targeting. `fx-on-<code>` retargets the swap to a different
// element when the response carries that status code.
//
// Native HTMX 4 capability: compiles `fx-on-<code>="selector"` directly to single canonical
// `hx-status:<code>="{ target: 'selector' }"` attribute for native HTMX processing.

import { log } from './logger.js';
import { setGeneratedAttribute, removeGeneratedAttribute } from './generated-attributes.js';

const ON_PREFIX = 'fx-on-';

export interface OnStatusHandler {
  disconnect(): void;
}

const statusCleanups = new WeakMap<Element, OnStatusHandler>();
const activeStatusHandlers = new Set<OnStatusHandler>();

/**
 * Scans `element` for `fx-on-<code>` attributes and compiles them directly into native HTMX 4
 * status targeting attributes. Handles signature tracking and dynamic runtime updates.
 */
export function wireStatusTargeting(element: Element): OnStatusHandler | null {
  if (typeof document === 'undefined') return null;

  const rules = collectRules(element);
  const signature = Array.from(rules.entries())
    .sort(([a], [b]) => a - b)
    .map(([c, s]) => `${c}:${s}`)
    .join(';');

  const existingSig = element.getAttribute('data-flux-status-signature');
  const existingHandler = statusCleanups.get(element);

  if (existingSig === signature && existingHandler) {
    return existingHandler;
  }
  
  if (existingHandler) {
    existingHandler.disconnect();
  }

  // Remove stale hx-status:* attributes no longer declared
  for (const attr of Array.from(element.attributes)) {
    if (attr.name.startsWith('hx-status:')) {
      const code = Number(attr.name.slice('hx-status:'.length));
      if (!rules.has(code)) {
        removeGeneratedAttribute(element, attr.name);
      }
    }
  }

  if (rules.size === 0) {
    existingHandler?.disconnect();
    element.removeAttribute('data-flux-status-signature');
    return null;
  }

  let wiredCount = 0;
  // Compile directly to native HTMX 4 status target attributes using central attribute registry
  for (const [code, selector] of rules) {
    try {
      document.querySelector(selector);
    } catch (e) {
      log.warn(`invalid CSS selector "${selector}" in fx-on-${code}:`, e);
      removeGeneratedAttribute(element, `hx-status:${code}`);
      continue;
    }

    const nativeStatusAttr = `hx-status:${code}`;
    setGeneratedAttribute(element, nativeStatusAttr, JSON.stringify({ target: selector }));
    wiredCount++;
  }

  if (wiredCount === 0) {
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('hx-status:')) {
        removeGeneratedAttribute(element, attr.name);
      }
    }
    existingHandler?.disconnect();
    element.removeAttribute('data-flux-status-signature');
    return null;
  }

  element.setAttribute('data-flux-status-signature', signature);
  element.setAttribute('data-flux-status', '1');

  const handler: OnStatusHandler = {
    disconnect() {
      statusCleanups.delete(element);
      activeStatusHandlers.delete(handler);
      element.removeAttribute('data-flux-status');
      element.removeAttribute('data-flux-status-signature');
    },
  };

  statusCleanups.set(element, handler);
  activeStatusHandlers.add(handler);
  return handler;
}

/** Reads every `fx-on-<code>` attribute on `element` into a status → selector map. */
export function collectRules(element: Element): Map<number, string> {
  const rules = new Map<number, string>();
  for (const attr of Array.from(element.attributes)) {
    if (!attr.name.startsWith(ON_PREFIX)) continue;
    const code = Number(attr.name.slice(ON_PREFIX.length));
    if (Number.isInteger(code) && code > 0 && attr.value) {
      rules.set(code, attr.value);
    }
  }
  return rules;
}

/** Installs the global status-targeting listener for newly processed elements. */
export function installStatusTargeting(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onBeforeProcess = (evt: Event) => {
    const root = (evt as CustomEvent).target;
    if (!(root instanceof Element)) return;

    for (const el of elementsWithStatusRules(root)) {
      const handler = wireStatusTargeting(el);
      if (handler) {
        el.setAttribute('data-flux-status', '1');
      }
    }
  };

  const onCleanupElement = (evt: Event) => {
    const root = (evt as CustomEvent).target;
    if (root instanceof Element) {
      statusCleanups.get(root)?.disconnect();
      for (const el of Array.from(root.querySelectorAll('*'))) {
        statusCleanups.get(el)?.disconnect();
      }
    }
  };

  document.addEventListener('htmx:before:process', onBeforeProcess);
  document.addEventListener('htmx:before:cleanup:element', onCleanupElement);
  document.addEventListener('htmx:beforeCleanupElement', onCleanupElement);

  return () => {
    document.removeEventListener('htmx:before:process', onBeforeProcess);
    document.removeEventListener('htmx:before:cleanup:element', onCleanupElement);
    document.removeEventListener('htmx:beforeCleanupElement', onCleanupElement);
    disposeStatusTargeting();
  };
}

/** Disconnects all status targeting listeners and clears WeakMap/Set state. */
export function disposeStatusTargeting(): void {
  for (const handler of Array.from(activeStatusHandlers)) {
    handler.disconnect();
  }
  activeStatusHandlers.clear();
  if (typeof document !== 'undefined') {
    for (const el of Array.from(document.querySelectorAll('[data-flux-status]'))) {
      el.removeAttribute('data-flux-status');
      el.removeAttribute('data-flux-status-signature');
    }
  }
}

/** Root plus descendants that declare at least one `fx-on-<code>` attribute. */
function elementsWithStatusRules(root: Element): Element[] {
  const out: Element[] = [];
  if (hasStatusRule(root)) out.push(root);
  for (const el of root.querySelectorAll('*')) {
    if (hasStatusRule(el)) out.push(el);
  }
  return out;
}

function hasStatusRule(el: Element): boolean {
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith(ON_PREFIX)) return true;
  }
  return false;
}
