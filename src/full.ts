// Standalone distribution entry. Bundles htmx + Flux + UI plugins + net extras into one
// IIFE for server-rendered apps (Django, Flask, Go, Laravel) that want a single <script>.
//
// Handles duplicate-dependency detection: if htmx was already loaded, the policy
// (default "warn" in dev) decides whether to reuse it or fail.

import htmx from 'htmx.org';
import {
  configure,
  process,
  reconfigure,
  dispose,
  cache,
  use,
  unuse,
  action,
  recipe,
  registerAction,
  bootstrapFlux,
  onBodyReady,
  config as fluxConfig,
  type DisposeOptions,
  type FluxApi,
} from './flux.js';
import { FLUX_VERSION } from './core/version.js';
import { readFluxMetaConfig, duplicatePolicy, reportDependencies } from './core/startup.js';
import { inspectElement, doctor } from './diagnostics/doctor.js';
import { installNet, offline, uploadPlugin, optimisticPlugin } from './net.js';

// UI Plugins
import { installTabs } from './plugins/tabs.js';
import { installAccordion } from './plugins/accordion.js';
import { installModal } from './plugins/modal.js';
import { installTransitions } from './plugins/transitions.js';
import { installState } from './plugins/state.js';
import { installPersist } from './plugins/persist.js';
import { installTable } from './plugins/table.js';
import { installForm } from './plugins/form.js';

export { FLUX_VERSION };

type WindowWithGlobals = typeof window & { Flux?: FluxApi; htmx?: unknown };

function bootstrap(): FluxApi {
  const win = (typeof window !== 'undefined' ? window : {}) as WindowWithGlobals;
  const metaConfig = readFluxMetaConfig();
  const policy = metaConfig.duplicatePolicy ?? 'reuse';

  // Apply duplicate dependency checks before assigning globals or initializing
  duplicatePolicy('htmx', win.htmx, policy);

  // Expose globals for standalone usage in browser scripts
  win.htmx = htmx;

  let started = false;

  const startAll = (element?: Element) => {
    if (!started) {
      installNet();
      configure(metaConfig.flux);

      // Install UI plugins
      installTabs();
      installAccordion();
      installModal();
      installTransitions();
      installState();
      installPersist();
      installTable();
      installForm();

      started = true;
    }
    onBodyReady(() => process(element));
  };

  const api: FluxApi = {
    version: FLUX_VERSION,
    get dependencies() {
      return reportDependencies({ htmx });
    },
    get isStarted() {
      return started;
    },
    get config() {
      return fluxConfig();
    },
    start: startAll,
    configure,
    reconfigure,
    process,
    dispose: (opts?: DisposeOptions) => {
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
    registerAction,
    offline,
    plugins: { upload: uploadPlugin, optimistic: optimisticPlugin },
  };

  // bootstrapFlux owns the window.Flux slot, the Flux duplicate policy, and meta-tag
  // autoStart — so the modular and full builds can never race for the global.
  return bootstrapFlux({ api, start: startAll });
}

export default bootstrap();
