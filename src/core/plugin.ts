// Flux Public Plugin System: Flux.use(plugin), Flux.unuse(pluginName)

import { log } from './logger.js';

export type PluginCleanup = () => void;

export interface FluxPluginApi {
  version: string;
  registerPreset(
    attribute: string,
    handler: (element: HTMLElement, value: string) => boolean,
    options?: { override?: boolean },
  ): PluginCleanup;
}

export interface FluxPlugin {
  name: string;
  setup(api: FluxPluginApi): PluginCleanup | void;
}

const PRESET_NAME_REGEX = /^[a-z][a-z0-9-]*$/;

const installedPlugins = new Map<string, FluxPlugin>();
const activePluginCleanups = new Map<string, PluginCleanup>();
const pluginPresetTeardowns = new Map<string, Array<() => void>>();

export function isValidPresetAttribute(attribute: string): boolean {
  if (!attribute || typeof attribute !== 'string') return false;
  const name = attribute.startsWith('fx-') ? attribute.slice(3) : attribute;
  return PRESET_NAME_REGEX.test(name);
}

export function usePlugin(plugin: FluxPlugin, api: FluxPluginApi, isStarted = false): void {
  if (!plugin || !plugin.name || typeof plugin.name !== 'string') {
    log.error('Flux.use() requires a valid plugin object with a name string property');
    return;
  }

  installedPlugins.set(plugin.name, plugin);
  activatePlugin(plugin, api);
}

export function activatePlugins(api: FluxPluginApi): void {
  for (const plugin of installedPlugins.values()) {
    activatePlugin(plugin, api);
  }
}

function activatePlugin(plugin: FluxPlugin, api: FluxPluginApi): void {
  deactivatePluginInstance(plugin.name);

  const teardowns: Array<() => void> = [];
  pluginPresetTeardowns.set(plugin.name, teardowns);

  const safeApi: FluxPluginApi = {
    version: api.version,
    registerPreset: (attribute, handler, options) => {
      if (!isValidPresetAttribute(attribute)) {
        log.error(
          `Invalid preset attribute name "${attribute}"; attribute name must match ^[a-z][a-z0-9-]*$`,
        );
        return () => {};
      }
      const teardown = api.registerPreset(attribute, handler, options);
      teardowns.push(teardown);
      return teardown;
    },
  };

  try {
    const cleanup = plugin.setup(safeApi);
    if (typeof cleanup === 'function') {
      activePluginCleanups.set(plugin.name, cleanup);
    }
  } catch (error) {
    log.error(`Plugin "${plugin.name}" setup failed:`, error);
  }
}

function deactivatePluginInstance(name: string): void {
  const teardowns = pluginPresetTeardowns.get(name);
  if (teardowns) {
    for (const t of teardowns) {
      try {
        t();
      } catch {
        // Ignore teardown error
      }
    }
    pluginPresetTeardowns.delete(name);
  }

  if (activePluginCleanups.has(name)) {
    try {
      activePluginCleanups.get(name)?.();
    } catch (e) {
      log.error('Plugin cleanup failed:', e);
    }
    activePluginCleanups.delete(name);
  }
}

export function deactivatePlugins(): void {
  for (const name of Array.from(installedPlugins.keys())) {
    deactivatePluginInstance(name);
  }
}

export { deactivatePlugins as disposePlugins };

export function unregisterPlugin(name: string): void {
  deactivatePluginInstance(name);
  installedPlugins.delete(name);
}
