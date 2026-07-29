// Preset and shorthand expansion seam. See docs/architecture.md for the lifecycle rationale.
//
// Dynamic Preset Registry Integration: Scans root and descendants dynamically using
// registered preset attributes, then expands generic shorthand attributes.

import { expandElement, fluxSelector, applyRecipeAndScope } from './expand.js';
import { getPresetRegistry, applyPreset } from '../presets/index.js';

/** Scans `root` for unexpanded Flux shorthand and presets, writing the HTMX equivalents. */
export function expandPresets(root: Element): number {
  let count = 0;

  const registry = getPresetRegistry();
  
  // P0-7 / P1-9: Apply recipes and scopes first so that generated fx-* presets are caught by the preset registry
  const fluxElements = matching(root, fluxSelector());
  for (const el of fluxElements) {
    applyRecipeAndScope(el);
  }

  for (const [attr] of registry) {
    const selector = `[${attr}]`;
    for (const el of matching(root, selector)) {
      const value = el.getAttribute(attr);
      if (value === null) continue;
      if (applyPreset(el, attr, value, (a) => el.getAttribute(a) ?? undefined)) {
        count++;
      }
    }
  }

  for (const el of fluxElements) {
    count += expandElement(el);
  }

  return count;
}

/** Clears data-flux-preset markers across document for runtime re-initialization. */
export function clearPresetMarkers(): void {
  if (typeof document === 'undefined') return;
  for (const el of Array.from(document.querySelectorAll('[data-flux-preset]'))) {
    el.removeAttribute('data-flux-preset');
  }
}

/**
 * Registers the `htmx:before:process` listener that drives expansion.
 * Returns a teardown for tests; production callers leave it installed for the page lifetime.
 */
export function install(): (() => void) | null {
  if (typeof document === 'undefined') return null;

  document.addEventListener('htmx:before:process', onBeforeProcess);
  return () => {
    document.removeEventListener('htmx:before:process', onBeforeProcess);
    clearPresetMarkers();
  };
}

function onBeforeProcess(evt: Event): void {
  const target = (evt as CustomEvent).target;
  if (target instanceof Element) {
    expandPresets(target);
  }
}

/** `root` plus descendants matching `selector`, deduplicated. */
function matching(root: Element, selector: string): Element[] {
  const out: Element[] = [];
  if (root.matches?.(selector)) out.push(root);
  out.push(...root.querySelectorAll(selector));
  return out;
}
