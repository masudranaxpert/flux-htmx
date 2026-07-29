// Standalone distribution entry. Bundles htmx + Flux into one IIFE for server-
// rendered apps (Django, Flask, Go, Laravel) that want a single <script> tag.
//
// Handles duplicate-dependency detection: if htmx was already loaded, the policy
// (default "warn" in dev) decides whether to reuse it or fail.

import htmx from 'htmx.org';
import { configure, process, dispose, cache, use, unuse, action, recipe } from './flux.js';
import { FLUX_VERSION } from './core/version.js';
import { readFluxMetaConfig, duplicatePolicy, reportDependencies } from './core/startup.js';
import { inspectElement, doctor } from './diagnostics/doctor.js';

// UI Plugins
import { installDropdown } from './plugins/dropdown.js';
import { installTabs } from './plugins/tabs.js';
import { installAccordion } from './plugins/accordion.js';
import { installModal } from './plugins/modal.js';
import { installTransitions } from './plugins/transitions.js';
import { installState } from './plugins/state.js';
import { installPersist } from './plugins/persist.js';
import { installTable } from './plugins/table.js';
import { installForm } from './plugins/form.js';

export { FLUX_VERSION };

type WindowWithGlobals = typeof window & { Flux?: any; htmx?: any };

function bootstrap() {
  const win =
    typeof window !== 'undefined' ? (window as WindowWithGlobals) : ({} as WindowWithGlobals);
  const metaConfig = readFluxMetaConfig();
  const policy = metaConfig.duplicatePolicy ?? 'reuse';

  const existingFlux = win.Flux;
  if (existingFlux && existingFlux.version) {
    return existingFlux;
  }

  // Apply duplicate dependency checks before assigning globals or initializing
  duplicatePolicy('htmx', win.htmx, policy);

  // Expose globals for standalone usage in browser scripts
  win.htmx = htmx;

  let started = false;

  const startAll = (element?: Element) => {
    if (!started) {
      configure(metaConfig.flux);

      // Install UI Plugins
      installDropdown();
      installTabs();
      installAccordion();
      installModal();
      installTransitions();
      installState();
      installPersist();
      installTable();
      installForm();

      process(element);
      started = true;
    } else {
      process(element);
    }
  };

  const api = {
    version: FLUX_VERSION,
    get dependencies() {
      return reportDependencies({ htmx });
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
      dispose(opts);
      started = false;
    },
    cache,
    htmx,
    inspect: inspectElement,
    doctor,
    use,
    unuse,
    action,
    recipe,
  };

  win.Flux = api;

  if (metaConfig.autoStart) {
    startAll();
  }

  return api;
}

export default bootstrap();
