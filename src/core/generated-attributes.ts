// Generated Attribute Registry. Tracks ownership of generated hx-* attributes written by Flux
// so that user-written raw hx-* attributes are preserved, user attribute takeovers are detected,
// runtime fx-* attribute edits sync seamlessly, and hard/soft attribute cleanups are fully supported
// across detached elements, external roots, and Shadow DOM trees via an iterable Set index.

import { getPresetRegistry } from '../presets/index.js';

const generatedAttributes = new WeakMap<Element, Map<string, string>>();
const generatedElements = new Set<Element>();

/**
 * Sets a generated attribute on `element`. If the attribute already exists and was NOT generated
 * by Flux (or user mutated the attribute value), Flux leaves it untouched.
 * Returns true if a new attribute was written or an existing generated attribute was modified.
 */
export function setGeneratedAttribute(element: Element, name: string, value: string): boolean {
  const existing = element.getAttribute(name);
  const map = generatedAttributes.get(element);
  const generatedValue = map?.get(name);
  const owned = generatedValue !== undefined;

  // User mutated existing generated attribute: surrender ownership to user
  if (owned && existing !== null && existing !== generatedValue) {
    map?.delete(name);
    if (map?.size === 0) {
      generatedAttributes.delete(element);
      generatedElements.delete(element);
    }
    return false;
  }

  // User-written raw hx-* attribute: preserve raw user attribute
  if (existing !== null && !owned) {
    return false;
  }

  // Already matches generated value: idempotent no-op
  if (existing === value && owned) {
    return false;
  }

  element.setAttribute(name, value);

  const attrMap = map ?? new Map<string, string>();
  attrMap.set(name, value);
  generatedAttributes.set(element, attrMap);
  generatedElements.add(element);
  return true;
}

/** Returns the map of generated attributes owned by Flux on `element`. */
export function getGeneratedAttributes(element: Element): Map<string, string> {
  return new Map(generatedAttributes.get(element) ?? []);
}

/** Checks whether `element` has a generated attribute with `name` owned by Flux. */
export function hasGeneratedAttribute(element: Element, name: string): boolean {
  return generatedAttributes.get(element)?.has(name) ?? false;
}

/** Removes a single generated attribute owned by Flux from `element`. */
export function removeGeneratedAttribute(element: Element, name: string): void {
  const attrMap = generatedAttributes.get(element);
  const generatedValue = attrMap?.get(name);
  if (generatedValue === undefined) return;

  if (element.getAttribute(name) === generatedValue) {
    element.removeAttribute(name);
  }

  attrMap?.delete(name);
  if (attrMap?.size === 0) {
    generatedAttributes.delete(element);
    generatedElements.delete(element);
  }
}

/** Removes all generated attributes written by Flux from tracked elements across all DOM trees. */
export function removeGeneratedAttributes(element?: Element, hardDispose = false): void {
  if (element) {
    cleanElementGeneratedAttributes(element, hardDispose);
    return;
  }

  for (const el of Array.from(generatedElements)) {
    cleanElementGeneratedAttributes(el, hardDispose);
  }
  generatedElements.clear();
}

function cleanElementGeneratedAttributes(element: Element, hardDispose = false): void {
  const attrMap = generatedAttributes.get(element);
  if (attrMap) {
    for (const [name, generatedValue] of attrMap) {
      if (element.getAttribute(name) === generatedValue) {
        element.removeAttribute(name);
      }
    }
    generatedAttributes.delete(element);
    generatedElements.delete(element);
  }

  if (hardDispose) {
    const fluxDataAttrs = [
      'data-flux-preset',
      'data-flux-preset-signature',
      'data-flux-status',
      'data-flux-status-signature',
      'data-flux-disabled',
      'data-flux-was-disabled',
      'data-flux-disable-count',
      'data-flux-loading',
      'data-flux-success',
      'data-flux-error',
      'data-flux-http-error',
      'data-flux-network-error',
      'data-flux-timeout',
      'data-flux-aborted',
      'data-flux-remove',
    ];
    for (const attr of fluxDataAttrs) {
      element.removeAttribute(attr);
    }
    for (const attr of Array.from(element.attributes)) {
      if (attr.name.startsWith('data-flux-gen-')) {
        element.removeAttribute(attr.name);
      }
    }
  }
}

/** Reconciles all tracked elements, removing generated hx-* when source fx-* or preset was removed. */
export function reconcileGeneratedAttributes(root?: Element): void {
  const presetRegistry = getPresetRegistry();

  for (const element of Array.from(generatedElements)) {
    if (root && root !== element && !root.contains(element)) continue;

    const attrMap = generatedAttributes.get(element);
    if (!attrMap) continue;

    // Check if preset attribute was removed or unregistered
    const currentPreset = element.getAttribute('data-flux-preset');
    let hasPresetAttr = false;
    if (currentPreset) {
      const presetAttr = `fx-${currentPreset}`;
      hasPresetAttr = element.hasAttribute(presetAttr) && presetRegistry.has(presetAttr);
      if (!hasPresetAttr) {
        element.removeAttribute('data-flux-preset');
        element.removeAttribute('data-flux-preset-signature');
      }
    }

    for (const [name] of Array.from(attrMap.entries())) {
      if (name.startsWith('hx-status:')) {
        const status = name.replace('hx-status:', '');
        if (!element.hasAttribute(`fx-on-${status}`)) {
          removeGeneratedAttribute(element, name);
        }
      } else if (name.startsWith('hx-')) {
        const fxName = name.replace(/^hx-/, 'fx-');
        const isPresetGenerated = Boolean(currentPreset);

        if (!isPresetGenerated && !element.hasAttribute(fxName)) {
          removeGeneratedAttribute(element, name);
          element.removeAttribute(`data-flux-gen-shorthand-${name.replace(/^hx-/, '')}`);
        } else if (isPresetGenerated && !hasPresetAttr) {
          removeGeneratedAttribute(element, name);
        }
      }
    }
  }
}
