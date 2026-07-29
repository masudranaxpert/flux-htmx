// Higher-level Flux presets. Data-driven preset definition registry with option signatures and override protection.

import { log } from '../core/logger.js';
import { applySearch } from './search.js';
import { applyLoad } from './load.js';
import { applyPoll } from './poll.js';
import { applyInfinite } from './infinite.js';
import { applySubmit } from './submit.js';
import { applyDelete } from './delete.js';
import { applyAutosave } from './autosave.js';
import { applyPagination } from './pagination.js';
import { getGeneratedAttributes } from '../core/generated-attributes.js';

export { applySearch } from './search.js';
export { applyLoad } from './load.js';
export { applyPoll } from './poll.js';
export { applyInfinite } from './infinite.js';
export { applySubmit } from './submit.js';
export { applyDelete } from './delete.js';
export { applyAutosave } from './autosave.js';
export { applyPagination } from './pagination.js';

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
    }),
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
  const hasOwnedAttrs = getGeneratedAttributes(element).size > 0;

  if (isPresetGenerated && currentSig === signature && hasOwnedAttrs) {
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
    'fx-target',
    'fx-swap',
    'fx-delay',
    'fx-interval',
    'fx-min-length',
    'fx-method',
    'fx-indicator',
    'fx-append',
    'fx-prepend',
    'fx-confirm',
    'fx-disable',
    'fx-remove',
    'fx-reset',
    'fx-progress',
    'fx-max-size',
    'fx-allowed-types',
    'fx-success',
    'fx-error',
    'fx-invalidate',
  ];
  const opts = attrs.map((a) => `${a}=${element.getAttribute(a) ?? ''}`).join(';');
  return `${preset}:${value}:${opts}`;
}
