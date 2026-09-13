// Shared runtime config accessor. Modules that live below flux.ts in the import graph
// (presets, cache wiring) read the resolved config here instead of importing the entry
// back — which would create a cycle.

import type { ResolvedConfig } from './config.js';

let current: ResolvedConfig | null = null;

/** Stores the resolved config (called by configure/dispose in flux.ts). */
export function setRuntimeConfig(config: ResolvedConfig | null): void {
  current = config;
}

/** Returns the active resolved config, or null before configure()/after dispose(). */
export function runtimeConfig(): ResolvedConfig | null {
  return current;
}
