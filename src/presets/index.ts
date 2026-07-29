// Higher-level Flux presets. Data-driven preset definition registry with option signatures and override protection.

import { log } from '../core/logger.js';
import { applySearch, disconnectSearch } from './search.js';
import { applyLoad } from './load.js';
import { applyPoll } from './poll.js';
import { applyInfinite } from './infinite.js';
import { applySubmit, disconnectSubmit } from './submit.js';
import { applyDelete, disconnectDelete } from './delete.js';
import { applyAutosave } from './autosave.js';
import { applyPagination } from './pagination.js';
import { applyPrefetch, disconnectPrefetch, disposePrefetchControllers } from './prefetch.js';
import { applyRealtime, disconnectRealtime } from './realtime.js';
import { getGeneratedAttributes } from '../core/generated-attributes.js';

export { applySearch, disconnectSearch } from './search.js';
export { applyLoad } from './load.js';
export { applyPoll } from './poll.js';
export { applyInfinite } from './infinite.js';
export { applySubmit } from './submit.js';
export { applyDelete } from './delete.js';
export { applyAutosave } from './autosave.js';
export { applyPagination } from './pagination.js';
export { applyPrefetch, disconnectPrefetch, disposePrefetchControllers } from './prefetch.js';
export { applyRealtime, disconnectRealtime } from './realtime.js';

export interface PresetContext {
  target?: string;
  indicator?: string;
  swap?: string;
}

export interface RegisterPresetOptions {
  override?: boolean;
}

export interface PresetDefinition {
  attribute: string;
  connect(element: Element, value: string, ctx: (attr: string) => string | undefined): boolean;
  disconnect?(element: Element): void;
  override?: boolean;
}

const presetRegistry = new Map<string, PresetDefinition>();

export function getPresetRegistry(): ReadonlyMap<string, PresetDefinition> {
  return presetRegistry;
}

export function registerPreset(
  definition: PresetDefinition,
  options?: RegisterPresetOptions,
): () => void {
  if (!definition || !definition.attribute || typeof definition.attribute !== 'string') {
    log.error('Invalid preset definition: attribute is required');
    return () => {};
  }

  const allowOverride = definition.override || options?.override;
  if (presetRegistry.has(definition.attribute) && !allowOverride) {
    log.warn(
      `Preset "${definition.attribute}" is already registered; use { override: true } to replace`,
    );
    return () => {};
  }

  const previous = presetRegistry.get(definition.attribute);
  presetRegistry.set(definition.attribute, definition);

  return () => {
    if (presetRegistry.get(definition.attribute) === definition) {
      if (previous) {
        presetRegistry.set(definition.attribute, previous);
      } else {
        presetRegistry.delete(definition.attribute);
      }
    }
  };
}

// Register built-in presets
registerPreset({
  attribute: 'fx-search',
  connect: (element, value, ctx) =>
    applySearch(element, {
      url: value,
      target: ctx('fx-target'),
      delay: ctx('fx-delay'),
      minLength: ctx('fx-min-length'),
      indicator: ctx('fx-indicator'),
      clearSelector: ctx('fx-search-clear'),
    }),
  disconnect: (element) => disconnectSearch(element),
});

registerPreset({
  attribute: 'fx-load',
  connect: (element, value, ctx) =>
    applyLoad(element, {
      url: value,
      target: ctx('fx-target'),
      swap: ctx('fx-swap'),
      indicator: ctx('fx-indicator'),
    }),
});

registerPreset({
  attribute: 'fx-page',
  connect: (element, value, ctx) =>
    applyPagination(element, {
      url: value,
      target: ctx('fx-target'),
      append: element.hasAttribute('fx-append'),
      prepend: element.hasAttribute('fx-prepend'),
      indicator: ctx('fx-indicator'),
    }),
});

registerPreset({
  attribute: 'fx-poll',
  connect: (element, value, ctx) => {
    let url = value;
    let interval = ctx('fx-interval');
    if (!interval) {
      if (/^\d+(ms|s|m)?$/.test(value.trim())) {
        interval = value;
        url = ctx('fx-get') ?? ctx('hx-get') ?? '';
      } else {
        interval = '5s';
      }
    }
    return applyPoll(element, {
      url,
      interval,
      target: ctx('fx-target'),
      indicator: ctx('fx-indicator'),
    });
  },
});

registerPreset({
  attribute: 'fx-infinite',
  connect: (element, value, ctx) =>
    applyInfinite(element, {
      url: value,
      target: ctx('fx-target'),
      indicator: ctx('fx-indicator'),
    }),
});

registerPreset({
  attribute: 'fx-submit',
  connect: (element, value, ctx) =>
    applySubmit(element, {
      url: value,
      target: ctx('fx-target'),
      swap: ctx('fx-swap'),
      indicator: ctx('fx-indicator'),
      confirm: ctx('fx-confirm'),
      success: ctx('fx-success'),
      error: ctx('fx-error'),
      invalidate: ctx('fx-invalidate'),
      reset: element.hasAttribute('fx-reset'),
      disable: ctx('fx-disable'),
    }),
  disconnect: (element) => disconnectSubmit(element),
});

registerPreset({
  attribute: 'fx-delete',
  connect: (element, value, ctx) =>
    applyDelete(element, {
      url: value,
      confirm: ctx('fx-confirm'),
      target: ctx('fx-target'),
      remove: ctx('fx-remove'),
      swap: ctx('fx-swap'),
      indicator: ctx('fx-indicator'),
      success: ctx('fx-success'),
      invalidate: ctx('fx-invalidate'),
    }),
  disconnect: (element) => disconnectDelete(element),
});

registerPreset({
  attribute: 'fx-autosave',
  connect: (element, value, ctx) =>
    applyAutosave(element, {
      url: value,
      delay: ctx('fx-delay'),
      target: ctx('fx-target'),
      indicator: ctx('fx-indicator'),
    }),
});

registerPreset({
  attribute: 'fx-prefetch',
  connect: (element, value, ctx) =>
    applyPrefetch(element, {
      url: value,
    }),
  disconnect: (element) => disconnectPrefetch(element),
});

registerPreset({
  attribute: 'fx-realtime',
  connect: (element, value, ctx) =>
    applyRealtime(element, {
      url: value,
      target: ctx('fx-target'),
      swap: ctx('fx-swap'),
      event: ctx('fx-event'),
      withCredentials: element.hasAttribute('fx-with-credentials'),
    }),
  disconnect: (element) => disconnectRealtime(element),
});

/** Dispatches an element's preset attribute to its registered handler. Returns true if a preset ran. */
export function applyPreset(
  element: Element,
  preset: string,
  value: string,
  ctx: (attr: string) => string | undefined,
): boolean {
  const activeConflicts = checkPresetConflicts(element);
  if (activeConflicts.length > 1 && preset !== activeConflicts[0]) {
    // Single preset per element enforcement: skip secondary conflicting presets
    return false;
  }

  const signature = computePresetSignature(element, preset, value);
  const currentSig = element.getAttribute('data-flux-preset-signature');
  const isPresetGenerated = element.getAttribute('data-flux-preset') === preset.replace(/^fx-/, '');
  const generatedAttrs = getGeneratedAttributes(element);
  const hasOwnedAttrs = generatedAttrs.size > 0;
  
  let allAttrsPresent = true;
  if (hasOwnedAttrs) {
    for (const [name, expectedValue] of generatedAttrs.entries()) {
      if (element.getAttribute(name) !== expectedValue) {
        allAttrsPresent = false;
        break;
      }
    }
  }

  if (isPresetGenerated && currentSig === signature && hasOwnedAttrs && allAttrsPresent) {
    return false;
  }

  const handler = presetRegistry.get(preset);
  if (handler) {
    try {
      const result = handler.connect(element, value, ctx);
      if (result) {
        element.setAttribute('data-flux-preset-signature', signature);
      }
      return result;
    } catch (error) {
      log.error(`Preset "${preset}" connection failed:`, error);
      return false;
    }
  }
  return false;
}

function checkPresetConflicts(element: Element): string[] {
  const active: string[] = [];
  for (const attr of presetRegistry.keys()) {
    if (element.hasAttribute(attr)) active.push(attr);
  }
  if (active.length > 1) {
    log.warn(
      `Element carries conflicting preset attributes [${active.join(', ')}]; enforcing primary preset "${active[0]}"`,
    );
  }
  return active;
}

function computePresetSignature(element: Element, preset: string, value: string): string {
  const attrs = [
    'fx-target', 'fx-swap', 'fx-delay', 'fx-interval', 'fx-min-length',
    'fx-method', 'fx-indicator', 'fx-append', 'fx-prepend', 'fx-confirm',
    'fx-disable', 'fx-remove', 'fx-reset', 'fx-progress', 'fx-max-size',
    'fx-allowed-types', 'fx-success', 'fx-error', 'fx-invalidate',
  ];
  let opts = '';
  for (let i = 0; i < attrs.length; i++) {
    if (i > 0) opts += ';';
    opts += attrs[i] + '=' + (element.getAttribute(attrs[i]!) ?? '');
  }
  return `${preset}:${value}:${opts}`;
}
