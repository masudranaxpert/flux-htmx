// Diagnostics module providing Flux.inspect(element) and Flux.doctor() APIs for developers.

import { FLUX_VERSION } from '../core/version.js';
import { getGeneratedAttributes } from '../core/generated-attributes.js';
import { getPresetRegistry, groupOf } from '../presets/index.js';

export interface InspectionResult {
  element: Element | null;
  presets: string[];
  generatedAttributes: Record<string, string>;
  warnings: string[];
}

export function inspectElement(element: Element | null): InspectionResult {
  if (!(element instanceof Element)) {
    return {
      element: null,
      presets: [],
      generatedAttributes: {},
      warnings: ['A valid Element is required for inspection'],
    };
  }

  const registeredPresets = getPresetRegistry();
  const presets: string[] = [];
  for (const attr of registeredPresets.keys()) {
    if (element.hasAttribute(attr)) {
      presets.push(attr);
    }
  }

  const genMap = getGeneratedAttributes(element);
  const genObj: Record<string, string> = {};
  for (const [k, v] of genMap) genObj[k] = v;

  const warnings: string[] = [];

  // Check preset URLs
  for (const p of presets) {
    const val = element.getAttribute(p) ?? '';
    if (!val.trim()) {
      warnings.push(`empty or whitespace URL in preset "${p}"`);
    }
  }

  if (element.hasAttribute('fx-get') && !element.getAttribute('fx-get')?.trim()) {
    warnings.push('empty or whitespace fx-get attribute URL');
  }

  // Check preset conflicts: only presets sharing a conflict group actually conflict.
  // `presets` is collected in registry order, so members[0] matches the runtime-enforced primary.
  const byGroup = new Map<string, string[]>();
  for (const p of presets) {
    const g = groupOf(p);
    if (!g) continue;
    const arr = byGroup.get(g);
    if (arr) arr.push(p);
    else byGroup.set(g, [p]);
  }
  for (const [g, members] of byGroup) {
    if (members.length > 1) {
      warnings.push(
        `conflicting "${g}" presets on element [${members.join(', ')}]; primary "${members[0]}" will be enforced`,
      );
    }
  }

  if (element.hasAttribute('fx-append') && element.hasAttribute('fx-prepend')) {
    warnings.push(
      'conflicting pagination swap attributes fx-append and fx-prepend declared on same element',
    );
  }

  // Check raw hx-* vs fx-* method conflicts
  if (
    element.hasAttribute('hx-get') &&
    (element.hasAttribute('fx-post') || element.hasAttribute('fx-submit'))
  ) {
    warnings.push('conflicting raw hx-get attribute declared alongside fx-post/fx-submit');
  }

  // Check fx-cache validity
  if (element.hasAttribute('fx-cache')) {
    const rawCache = element.getAttribute('fx-cache') ?? '';
    if (rawCache === 'false') {
      warnings.push('fx-cache="false" explicitly disables caching for this request');
    } else if (rawCache && rawCache !== 'true' && !/^(\d+)(ms|s|m|h|d)?$/i.test(rawCache.trim())) {
      warnings.push(`invalid fx-cache TTL expression "${rawCache}"`);
    }
  }

  // Check arbitrary fx-on-<code> status attributes
  for (const attr of Array.from(element.attributes)) {
    if (/^fx-on-\d+$/.test(attr.name)) {
      const selector = attr.value.trim();
      if (!selector) {
        warnings.push(`empty status target selector in ${attr.name}`);
      } else {
        try {
          if (typeof document !== 'undefined') document.querySelector(selector);
        } catch {
          warnings.push(`invalid CSS selector "${selector}" in ${attr.name}`);
        }
      }
    }
  }

  return {
    element,
    presets,
    generatedAttributes: genObj,
    warnings,
  };
}

export interface DoctorReport {
  fluxVersion: string;
  htmxDetected: boolean;
  htmxVersion: string;
  elementsInspected: number;
  warnings: string[];
}

export function doctor(root?: Element): DoctorReport {
  const activeRoot = root ?? (typeof document !== 'undefined' ? document.body : null);
  const htmx =
    (typeof window !== 'undefined' ? (window as any).htmx : undefined) ??
    (typeof globalThis !== 'undefined' ? (globalThis as any).htmx : undefined);
  const htmxVersion = htmx?.version ?? htmx?.VERSION ?? 'missing';

  const warnings: string[] = [];
  if (!htmx) {
    warnings.push('HTMX library is not loaded');
  } else if (!htmxVersion.startsWith('4.')) {
    warnings.push(`HTMX 4 is required; detected version ${htmxVersion}`);
  }

  let count = 0;
  if (activeRoot) {
    const registry = getPresetRegistry();
    const presetSelectors = Array.from(registry.keys()).map((attr) => `[${attr}]`);
    const verbSelectors = ['[fx-get]', '[fx-post]', '[fx-put]', '[fx-patch]', '[fx-delete]'];
    const selector = [...presetSelectors, ...verbSelectors, '[fx-cache]'].join(',');

    const elements: Element[] = [];
    if (activeRoot.matches?.(selector)) elements.push(activeRoot);
    elements.push(...Array.from(activeRoot.querySelectorAll(selector)));

    // Scan root & descendants for fx-on-* status attributes
    const allCandidates = [activeRoot, ...Array.from(activeRoot.querySelectorAll('*'))];
    for (const candidate of allCandidates) {
      for (const attr of Array.from(candidate.attributes)) {
        if (/^fx-on-\d+$/.test(attr.name)) {
          elements.push(candidate);
          break;
        }
      }
    }

    const seen = new Set<Element>();
    for (const el of elements) {
      if (seen.has(el)) continue;
      seen.add(el);
      count++;
      const insp = inspectElement(el);
      warnings.push(...insp.warnings);
    }
  }

  return {
    fluxVersion: FLUX_VERSION,
    htmxDetected: Boolean(htmx),
    htmxVersion,
    elementsInspected: count,
    warnings,
  };
}
