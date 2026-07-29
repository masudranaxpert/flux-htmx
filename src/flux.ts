// Flux public entry.
//
// Flux shorthand (fx-*) is expanded into HTMX attributes (hx-*) at processing time. HTMX's
// own attribute prefix is left at its default so raw hx-* remains an unconditional escape
// hatch. See docs/architecture.md and docs/decisions/0004-prefix-vs-expansion.md.

import htmx from 'htmx.org';
import { resolveConfig, type FluxConfig, type ResolvedConfig } from './core/config.js';
import { install, expandPresets } from './core/lifecycle.js';
import { resolveToken, shouldAttach } from './core/csrf.js';
import { installFeedback, resetFeedbackForTests } from './core/feedback.js';
import { installStatusTargeting, disposeStatusTargeting } from './core/status.js';
import { FragmentCache } from './cache/cache.js';
import { installCacheIntegration } from './cache/cacheWire.js';
import { installOpenController, disposeDialogControllers } from './components/components.js';
import { log } from './core/logger.js';
import { FLUX_VERSION } from './core/version.js';
import { readFluxMetaConfig, reportDependencies, verifyHtmxVersion } from './core/startup.js';
import { disposeDeleteControllers } from './presets/delete.js';
import { disposeSubmitControllers } from './presets/submit.js';
import { inspectElement, doctor } from './diagnostics/doctor.js';
import { getRequestContext } from './core/events.js';
import { safeQuerySelector } from './core/selectors.js';
import {
  usePlugin,
  unregisterPlugin,
  activatePlugins,
  deactivatePlugins,
  type FluxPlugin,
  type FluxPluginApi,
} from './core/plugin.js';
import { registerPreset } from './presets/index.js';
import {
  setGeneratedAttribute,
  removeGeneratedAttribute,
  removeGeneratedAttributes,
  reconcileGeneratedAttributes,
} from './core/generated-attributes.js';
import { installRetrySupport, disposeRetrySupport } from './core/retry.js';
import { installDeduplication } from './core/dedupe.js';
import { uploadPlugin } from './plugins/upload.js';
import { optimisticPlugin } from './plugins/optimistic.js';

export { type FluxConfig } from './core/config.js';
export { default as htmx } from 'htmx.org';
export { FLUX_VERSION };
export { inspectElement as inspect, doctor };
export { uploadPlugin, optimisticPlugin };

let configured = false;
const teardowns: Array<() => void> = [];
let currentConfig: ResolvedConfig | null = null;

export const cache = new FragmentCache();

export function isStarted(): boolean {
  return configured;
}

export function config(): ResolvedConfig | null {
  return currentConfig;
}

function pluginApi(): FluxPluginApi {
  return {
    version: FLUX_VERSION,
    registerPreset: (
      attribute: string,
      handler: (element: HTMLElement, value: string) => boolean,
      options?: { override?: boolean },
    ) =>
      registerPreset({
        attribute,
        connect: (el, val) => handler(el as HTMLElement, val),
        override: options?.override,
      }),
    setGeneratedAttribute,
    removeGeneratedAttribute,
    safeQuery: safeQuerySelector,
    readHtmxEvent: getRequestContext,
  };
}

export function use(plugin: FluxPlugin): void {
  usePlugin(plugin, pluginApi(), configured);
  if (configured && typeof document !== 'undefined') {
    process(document.body);
  }
}

export function unuse(pluginName: string): void {
  unregisterPlugin(pluginName);
  if (typeof document !== 'undefined' && document.body) {
    reconcileGeneratedAttributes(document.body);
  }
}

export function start(element?: Element, userConfig?: FluxConfig): void {
  if (!configured) {
    const metaConfig = readFluxMetaConfig();
    configure(userConfig ?? metaConfig.flux);
  }
  process(element);
}

export function reconfigure(userConfig?: FluxConfig, root?: Element): ResolvedConfig {
  dispose({ clearCache: false });
  const cfg = configure(userConfig);
  if (typeof document !== 'undefined') {
    process(root ?? document.body);
  }
  return cfg;
}

/**
 * Initialises Flux against the loaded HTMX instance.
 *
 * Applies configuration and installs the expansion, request, status, feedback and cache
 * hooks. Idempotent: later calls merge configuration without re-registering listeners.
 * Must run before HTMX processes the document.
 */
export function configure(userConfig?: FluxConfig): ResolvedConfig {
  if (configured) {
    throw new Error(
      '[flux] configure() called after start; use reconfigure() to restart runtime with new options',
    );
  }
  currentConfig = resolveConfig(userConfig);
  const activeHtmx =
    (typeof htmx !== 'undefined' ? htmx : undefined) ??
    (typeof window !== 'undefined' ? (window as any).htmx : undefined) ??
    (typeof globalThis !== 'undefined' ? (globalThis as any).htmx : undefined);

  if (activeHtmx?.config) {
    activeHtmx.config.defaultSwap = currentConfig.htmx.defaultSwap;
  }

  if (!configured) {
    const lifecycle = install();
    if (lifecycle) teardowns.push(lifecycle);
    teardowns.push(installRequestHooks(() => currentConfig));
    teardowns.push(installStatusTargeting());
    teardowns.push(installFeedback(() => currentConfig));
    teardowns.push(installCacheIntegration(cache, activeHtmx));
    teardowns.push(installOpenController());
    teardowns.push(installCleanupHook());
    teardowns.push(installRetrySupport());
    teardowns.push(installDeduplication());
    activatePlugins(pluginApi());
    configured = true;
  }

  return currentConfig;
}

/** Processes `element` (default `document.body`) through Flux expansion then HTMX. */
export function process(element?: Element): void {
  const root = element ?? document.body;
  reconcileGeneratedAttributes(root);
  expandPresets(root);
  const activeHtmx =
    (typeof htmx !== 'undefined' ? htmx : undefined) ??
    (typeof window !== 'undefined' ? (window as any).htmx : undefined) ??
    (typeof globalThis !== 'undefined' ? (globalThis as any).htmx : undefined);
  if (typeof activeHtmx?.process === 'function') {
    activeHtmx.process(root);
  }
}

export interface DisposeOptions {
  clearCache?: boolean;
  removeGeneratedAttributes?: boolean;
}

/** Removes Flux listeners and resets runtime state. Performs soft or hard disposal. */
export function dispose(options?: DisposeOptions): void {
  while (teardowns.length) teardowns.shift()?.();
  disposeRetrySupport();
  disposeStatusTargeting();
  disposeDeleteControllers();
  disposeSubmitControllers();
  disposeDialogControllers();
  deactivatePlugins();
  resetFeedbackForTests();

  if (options?.removeGeneratedAttributes) {
    removeGeneratedAttributes(undefined, true);
  }

  if (options?.clearCache !== false) {
    cache.clear();
  }
  configured = false;
  currentConfig = null;
}

interface RequestState {
  method: string;
  action: string;
  headers: Record<string, string> | Headers;
  timeout?: number;
  credentials: RequestCredentials;
}

function installRequestHooks(getConfig: () => ResolvedConfig | null): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = (evt: Event) => {
    const cfg = getConfig();
    if (!cfg) return;

    const detail = (evt as CustomEvent).detail as { ctx: { request: RequestState } } | undefined;
    const request = detail?.ctx?.request;
    if (!request) return;

    if (cfg.requests.timeoutMs > 0) {
      request.timeout = cfg.requests.timeoutMs;
    }
    request.credentials = cfg.requests.credentials;

    const token = resolveToken(cfg.csrf);
    if (shouldAttach(request.method, request.action, token) && token.value) {
      if (typeof (request.headers as any)?.set === 'function') {
        (request.headers as any).set(token.headerName, token.value);
      } else {
        request.headers = { ...(request.headers ?? {}), [token.headerName]: token.value };
      }
    }
  };

  document.addEventListener('htmx:config:request', handler);
  return () => document.removeEventListener('htmx:config:request', handler);
}

function installCleanupHook(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onCleanup = (evt: Event) => {
    const target = (evt as CustomEvent).detail?.elt ?? evt.target;
    if (target instanceof Element) {
      removeGeneratedAttributes(target);
      const children = Array.from(target.querySelectorAll('*'));
      for (const child of children) {
        removeGeneratedAttributes(child);
      }
    }
  };

  document.addEventListener('htmx:before:cleanup:element', onCleanup);
  return () => document.removeEventListener('htmx:before:cleanup:element', onCleanup);
}

function createFluxApi() {
  const activeHtmx =
    (typeof htmx !== 'undefined' ? htmx : undefined) ??
    (typeof window !== 'undefined' ? (window as any).htmx : undefined) ??
    (typeof globalThis !== 'undefined' ? (globalThis as any).htmx : undefined);

  const api = {
    version: FLUX_VERSION,
    get dependencies() {
      return reportDependencies({
        htmx: activeHtmx,
        alpine: typeof window !== 'undefined' ? (window as any).Alpine : undefined,
      });
    },
    get isStarted() {
      return configured;
    },
    get config() {
      return currentConfig;
    },
    start: (element?: Element, userConfig?: FluxConfig) => {
      if (!configured) configure(userConfig);
      process(element);
    },
    configure,
    reconfigure,
    process,
    dispose,
    cache,
    htmx: activeHtmx,
    inspect: inspectElement,
    doctor,
    use,
    unuse,
    plugins: {
      upload: uploadPlugin,
      optimistic: optimisticPlugin,
    },
  };

  return api;
}

let fluxApiInstance: ReturnType<typeof createFluxApi> | undefined;

if (typeof window !== 'undefined') {
  const activeHtmx =
    (typeof htmx !== 'undefined' ? htmx : undefined) ??
    (window as any).htmx ??
    (typeof globalThis !== 'undefined' ? (globalThis as any).htmx : undefined);
  verifyHtmxVersion(activeHtmx);

  const metaConfig = readFluxMetaConfig();
  const policy = metaConfig.duplicatePolicy ?? 'reuse';

  const existingFlux = (window as any).Flux;
  if (existingFlux && existingFlux.version) {
    if (policy === 'warn') {
      log.warn('Flux is already loaded; reusing existing instance');
    } else if (policy === 'error') {
      throw new Error('[flux] Flux is already loaded');
    }
    fluxApiInstance = existingFlux;
  } else {
    fluxApiInstance = createFluxApi();
    (window as any).Flux = fluxApiInstance;

    if (metaConfig.autoStart && !configured) {
      try {
        configure(metaConfig.flux);
        if (typeof document !== 'undefined') {
          if (document.readyState === 'loading') {
            const domHandler = () => process(document.body);
            document.addEventListener('DOMContentLoaded', domHandler, { once: true });
            teardowns.push(() => document.removeEventListener('DOMContentLoaded', domHandler));
          } else {
            process(document.body);
          }
        }
      } catch (e) {
        log.warn('auto-configure failed', e);
      }
    }
  }
}

export default fluxApiInstance ?? createFluxApi();
