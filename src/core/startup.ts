// Startup helpers: HTMX version assertion, meta-tag config reading, duplicate dependency policy,
// and dependency inspection.

import { log } from './logger.js';
import type { FluxConfig } from './config.js';

export interface HtmxGlobal {
  version?: string;
  VERSION?: string;
  config?: { defaultSwap?: string; defaultTimeout?: number };
  process?: (element: Element) => void;
  swap?: (opts: { target: Element; text: string; swap?: string; sourceElement?: Element }) => void;
}

export function verifyHtmxVersion(htmx: HtmxGlobal | undefined): void {
  if (!htmx) {
    throw new Error('[flux] HTMX was not found. Load HTMX 4 before Flux scripts.');
  }

  const version = htmx.version ?? htmx.VERSION;
  if (version && typeof version === 'string' && !version.startsWith('4.')) {
    throw new Error(`[flux] HTMX 4 is required; found ${version}. Load HTMX 4.x before Flux.`);
  }
}

let dualInstanceWarned = false;

export function resetStartupWarningsForTests(): void {
  dualInstanceWarned = false;
}

/**
 * Resolves the active HTMX instance: the bundled import first, then the script-tag
 * global (set by htmx itself or by the full Flux bundle).
 */
export function resolveHtmx(imported?: HtmxGlobal | null): HtmxGlobal | undefined {
  const fromGlobal =
    globalThis.htmx ??
    (typeof window !== 'undefined' ? (window as unknown as { htmx?: HtmxGlobal }).htmx : undefined);

  if (imported && typeof (imported as unknown as { process?: unknown }).process === 'function') {
    if (
      fromGlobal &&
      typeof fromGlobal === 'object' &&
      fromGlobal !== imported &&
      !dualInstanceWarned
    ) {
      dualInstanceWarned = true;
      log.warn('[flux] Both bundled and global HTMX instances detected; using bundled instance.');
    }
    return imported;
  }
  return fromGlobal && typeof fromGlobal === 'object'
    ? (fromGlobal as HtmxGlobal)
    : (imported ?? undefined);
}

export interface FluxMetaConfig {
  autoStart: boolean;
  duplicatePolicy: 'warn' | 'error' | 'reuse';
  flux?: FluxConfig;
}

export function readFluxMetaConfig(): FluxMetaConfig {
  if (typeof document === 'undefined') {
    return { autoStart: true, duplicatePolicy: 'warn' };
  }

  const meta = document.querySelector('meta[name="flux-config"]');
  const content = meta?.getAttribute('content');
  let parsed: Record<string, unknown> = {};

  if (content) {
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      log.warn('invalid flux-config meta tag (expected JSON):', e);
    }
  }

  const deps = parsed.dependencies as { duplicatePolicy?: 'warn' | 'error' | 'reuse' } | undefined;
  const policy = deps?.duplicatePolicy ?? 'warn';
  if (deps?.duplicatePolicy && !ALLOWED_POLICIES.has(deps.duplicatePolicy)) {
    throw new Error(
      `[flux] Invalid duplicatePolicy "${deps.duplicatePolicy}" (expected reuse | warn | error)`,
    );
  }

  return {
    autoStart: parsed.autoStart !== false,
    duplicatePolicy: policy,
    flux: parsed as FluxConfig,
  };
}

const ALLOWED_POLICIES = new Set(['reuse', 'warn', 'error']);

export function duplicatePolicy(
  name: string,
  instance: unknown,
  policy: 'warn' | 'error' | 'reuse' = 'warn',
): boolean {
  if (!ALLOWED_POLICIES.has(policy)) {
    throw new Error(`[flux] Invalid duplicatePolicy "${policy}" (expected reuse | warn | error)`);
  }
  if (instance) {
    if (policy === 'reuse') return true;
    if (policy === 'error') throw new Error(`Existing ${name} instance detected`);
    log.warn(`Existing ${name} instance detected`);
  }
  return false;
}

export function reportDependencies(
  deps: Record<string, { version?: string } | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(deps)) {
    out[key] = val?.version ?? 'unknown';
  }
  return out;
}
