// Standalone distribution entry. Bundles htmx + Alpine + Flux into one IIFE for server-
// rendered apps (Django, Flask, Go, Laravel) that want a single <script> tag.
//
// Handles duplicate-dependency detection: if htmx or Alpine was already loaded, the policy
// (default "warn" in dev) decides whether to reuse it or fail.

import htmx from 'htmx.org';
import Alpine from 'alpinejs';
import { configure, process, dispose, cache, use, unuse } from './flux.js';
import { registerAlpine } from './adapters/alpine.js';
import { FLUX_VERSION } from './core/version.js';
import { readFluxMetaConfig, duplicatePolicy, reportDependencies } from './core/startup.js';
import { inspectElement, doctor } from './diagnostics/doctor.js';

export { FLUX_VERSION };

type WindowWithGlobals = typeof window & { Flux?: any; htmx?: any; Alpine?: any };

function bootstrap() {
  const win = typeof window !== 'undefined' ? (window as WindowWithGlobals) : ({} as WindowWithGlobals);
  const metaConfig = readFluxMetaConfig();
  const policy = metaConfig.duplicatePolicy ?? 'reuse';

  const existingFlux = win.Flux;
  if (existingFlux && existingFlux.version) {
    return existingFlux;
  }

  // Apply duplicate dependency checks before assigning globals or initializing
  duplicatePolicy('htmx', win.htmx, policy);
  duplicatePolicy('alpine', win.Alpine, policy);

  // Expose globals for standalone usage in browser scripts
  win.htmx = htmx;
  win.Alpine = Alpine;

  let started = false;
  let alpineCleanup: (() => void) | null = null;

  const startAll = (element?: Element) => {
    if (!started) {
      configure(metaConfig.flux);
      alpineCleanup = registerAlpine(Alpine as never);
      process(element);
      Alpine.start();
      started = true;
    } else {
      process(element);
    }
  };

  const api = {
    version: FLUX_VERSION,
    get dependencies() {
      return reportDependencies({ htmx, alpine: Alpine as { version?: string } });
    },
    get isStarted() {
      return started;
    },
    get config() {
      return metaConfig.flux ?? null;
    },
    start: startAll,
    configure,
    process,
    dispose: (opts?: any) => {
      alpineCleanup?.();
      alpineCleanup = null;
      dispose(opts);
      started = false;
    },
    cache,
    htmx,
    Alpine,
    inspect: inspectElement,
    doctor,
    use,
    unuse,
  };

  win.Flux = api;

  if (metaConfig.autoStart) {
    startAll();
  }

  return api;
}

const fullApi = typeof window !== 'undefined' ? bootstrap() : ({} as any);
export default fullApi;
