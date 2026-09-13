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
import { installValidation } from './core/validation.js';
import { installStatusTargeting, disposeStatusTargeting } from './core/status.js';
import { registerRecipe } from './core/recipes.js';
import { setHeader } from './core/headers.js';
import { setRuntimeConfig } from './core/runtime.js';
import { installActionPipeline } from './core/action-lifecycle.js';
import { registerAction, defineActionPipeline } from './core/actions.js';
export { registerRecipe as recipe } from './core/recipes.js';
export { registerAction, defineActionPipeline as action } from './core/actions.js';
import type { FragmentCache } from './cache/cache.js';
import { cache } from './cache/instance.js';
import { installCacheIntegration } from './cache/cacheWire.js';
import { installOpenController, disposeDialogControllers } from './components/components.js';
import { log } from './core/logger.js';
import { FLUX_VERSION } from './core/version.js';
import {
  readFluxMetaConfig,
  reportDependencies,
  resolveHtmx,
  verifyHtmxVersion,
  type HtmxGlobal,
} from './core/startup.js';
import { disposeDeleteControllers, installDeleteControllers } from './presets/delete.js';
import { disposeSubmitControllers, installSubmitControllers } from './presets/submit.js';
import { disconnectPresetTree, disposePresetControllers } from './presets/index.js';
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
import { removeRecipeAndScopeAttributes } from './core/expand.js';
import { me, any, sugar, installDomSugar } from './core/sugar.js';

export { type FluxConfig } from './core/config.js';
export { default as htmx } from 'htmx.org';
export { FLUX_VERSION };
export { inspectElement as inspect, doctor };
export { applyRealtime, disconnectRealtime } from './presets/realtime.js';
export { applySearch, disconnectSearch } from './presets/search.js';
export { me, any, sugar };

/**
 * Public modular API surface. The full bundle adds the optional `offline` and `plugins`
 * blocks via the net entry; modular consumers import those from `flux-htmx/net`.
 */
export interface FluxApi {
  version: string;
  readonly dependencies: Record<string, string>;
  readonly isStarted: boolean;
  readonly config: ResolvedConfig | null;
  start(element?: Element, userConfig?: FluxConfig): void;
  configure(userConfig?: FluxConfig): ResolvedConfig;
  reconfigure(userConfig?: FluxConfig, root?: Element): ResolvedConfig;
  process(element?: Element): void;
  dispose(options?: DisposeOptions): void;
  recipe: typeof registerRecipe;
  action: typeof defineActionPipeline;
  registerAction: typeof registerAction;
  cache: FragmentCache;
  htmx: HtmxGlobal | undefined;
  inspect: typeof inspectElement;
  doctor: typeof doctor;
  use(plugin: FluxPlugin): void;
  unuse(pluginName: string): void;
  offline?: {
    readonly pending: number;
    flush(): Promise<void>;
    clear(): void;
  };
  plugins?: { upload: FluxPlugin; optimistic: FluxPlugin };
}

let configured = false;
const teardowns: Array<() => void> = [];
let currentConfig: ResolvedConfig | null = null;

export { cache };

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
      options?: { override?: boolean; disconnect?: (element: HTMLElement) => void },
    ) =>
      registerPreset({
        attribute,
        connect: (el, val) => handler(el as HTMLElement, val),
        disconnect: options?.disconnect
          ? (el) => options.disconnect?.(el as HTMLElement)
          : undefined,
        override: options?.override,
      }),
    setGeneratedAttribute,
    removeGeneratedAttribute,
    safeQuery: safeQuerySelector,
    readHtmxEvent: getRequestContext,
    registerAction,
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
  setRuntimeConfig(currentConfig);

  const activeHtmx = resolveHtmx(htmx);

  if (activeHtmx?.config) {
    activeHtmx.config.defaultSwap = currentConfig.htmx.defaultSwap;
  }

  if (!configured) {
    const lifecycle = install();
    if (lifecycle) teardowns.push(lifecycle);
    teardowns.push(installRequestHooks(() => currentConfig, activeHtmx));
    teardowns.push(installStatusTargeting());
    teardowns.push(installSubmitControllers());
    teardowns.push(installDeleteControllers());
    const validationTd = installValidation();
    if (validationTd) teardowns.push(validationTd);
    teardowns.push(installActionPipeline());
    teardowns.push(installFeedback(() => currentConfig));
    teardowns.push(installCacheIntegration(cache, activeHtmx));
    teardowns.push(installOpenController());
    teardowns.push(installCleanupHook());
    teardowns.push(installRetrySupport());
    teardowns.push(installDeduplication());
    installDomSugar();
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
  const activeHtmx = resolveHtmx(htmx);
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
  disposePresetControllers();

  if (options?.removeGeneratedAttributes) {
    removeRecipeAndScopeAttributes();
    removeGeneratedAttributes(undefined, true);
  }

  while (teardowns.length) teardowns.shift()?.();
  disposeRetrySupport();
  disposeStatusTargeting();
  disposeDeleteControllers();
  disposeSubmitControllers();
  disposeDialogControllers();
  deactivatePlugins();
  resetFeedbackForTests();

  if (options?.clearCache !== false) {
    cache.clear();
  }
  configured = false;
  currentConfig = null;
  setRuntimeConfig(null);
}

interface RequestState {
  method: string;
  action: string;
  headers: Record<string, string> | Headers;
  timeout?: number;
  signal?: AbortSignal;
  credentials: RequestCredentials;
}

function installRequestHooks(
  getConfig: () => ResolvedConfig | null,
  htmxInstance?: { config?: { defaultTimeout?: number } },
): () => void {
  if (typeof document === 'undefined') return () => {};

  const handler = (evt: Event) => {
    const cfg = getConfig();
    if (!cfg) return;

    const detail = (evt as CustomEvent).detail as { ctx: { request: RequestState } } | undefined;
    const request = detail?.ctx?.request;
    if (!request) return;

    const timeoutMs = cfg.requests.timeoutMs || htmxInstance?.config?.defaultTimeout || 0;
    const signals = AbortSignal as typeof AbortSignal & {
      any?: (signals: AbortSignal[]) => AbortSignal;
      timeout?: (milliseconds: number) => AbortSignal;
    };
    if (timeoutMs > 0 && request.signal && signals.any && signals.timeout) {
      request.signal = signals.any([request.signal, signals.timeout(timeoutMs)]);
      request.timeout = 0;
    } else if (cfg.requests.timeoutMs > 0) {
      request.timeout = cfg.requests.timeoutMs;
    }
    request.credentials = cfg.requests.credentials;

    const token = resolveToken(cfg.csrf);
    if (shouldAttach(request.method, request.action, token) && token.value) {
      setHeader(request.headers, token.headerName, token.value);
    }
  };

  document.addEventListener('htmx:config:request', handler);
  return () => document.removeEventListener('htmx:config:request', handler);
}

function installCleanupHook(): () => void {
  if (typeof document === 'undefined') return () => {};

  const onCleanup = (evt: Event) => {
    const target = (evt as CustomEvent).detail?.ctx?.targetElement ?? evt.target;
    if (target instanceof Element) {
      disconnectPresetTree(target);
      removeRecipeAndScopeAttributes(target);
      removeGeneratedAttributes(target);
      const children = Array.from(target.querySelectorAll('*'));
      for (const child of children) {
        removeGeneratedAttributes(child);
      }
    }
  };

  document.addEventListener('htmx:before:cleanup', onCleanup);
  return () => document.removeEventListener('htmx:before:cleanup', onCleanup);
}

function createFluxApi(): FluxApi {
  const activeHtmx = resolveHtmx(htmx);

  return {
    version: FLUX_VERSION,
    dependencies: reportDependencies({ htmx: activeHtmx }),
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
    recipe: registerRecipe,
    action: defineActionPipeline,
    registerAction,
    cache,
    htmx: activeHtmx,
    inspect: inspectElement,
    doctor,
    use,
    unuse,
  };
}

let fluxApiInstance: FluxApi | undefined;

/** Module-singleton accessor so the default export and bootstrapFlux share one API object. */
function getFluxApi(): FluxApi {
  fluxApiInstance ??= createFluxApi();
  return fluxApiInstance;
}

/** Runs `fn` now, or on DOMContentLoaded when the document is still loading. */
export function onBodyReady(fn: () => void): void {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    const handler = () => fn();
    document.addEventListener('DOMContentLoaded', handler, { once: true });
    teardowns.push(() => document.removeEventListener('DOMContentLoaded', handler));
  } else {
    fn();
  }
}

export interface FluxBootstrapOptions {
  /** API object to publish as `window.Flux` (defaults to the modular API). */
  api?: FluxApi;
  /** Custom auto-start routine (e.g. the full bundle's plugin-aware startAll). */
  start?: (element?: Element) => void;
}

/**
 * Publishes the Flux global, applies duplicate-load policy, and honours meta-tag autoStart.
 * Entry points call this explicitly: importing the module alone has no global side effects,
 * so modular and full builds can coexist without racing for `window.Flux`.
 */
export function bootstrapFlux(options?: FluxBootstrapOptions): FluxApi {
  if (typeof window === 'undefined') return options?.api ?? getFluxApi();

  const win = window as Window & { Flux?: Partial<FluxApi> };
  const metaConfig = readFluxMetaConfig();
  const policy = metaConfig.duplicatePolicy ?? 'reuse';

  const existingFlux = win.Flux;
  if (existingFlux && existingFlux.version) {
    if (policy === 'warn') {
      log.warn('Flux is already loaded; reusing existing instance');
    } else if (policy === 'error') {
      throw new Error('[flux] Flux is already loaded');
    }
    return existingFlux as FluxApi;
  }

  const activeHtmx =
    (typeof htmx !== 'undefined' ? htmx : undefined) ??
    (win as { htmx?: unknown }).htmx ??
    (globalThis as { htmx?: unknown }).htmx;
  verifyHtmxVersion(activeHtmx as { version?: string; VERSION?: string } | undefined);

  const api = options?.api ?? getFluxApi();
  win.Flux = api;

  if (metaConfig.autoStart && !configured) {
    try {
      if (options?.start) {
        options.start();
      } else {
        configure(metaConfig.flux);
        onBodyReady(() => process(document.body));
      }
    } catch (e) {
      log.warn('auto-configure failed', e);
    }
  }

  return api;
}

export default getFluxApi();
