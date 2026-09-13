// Optional networking extras: offline queue interception, upload and optimistic plugins.
// The full bundle loads these automatically; modular consumers opt in via `flux-htmx/net`
// so basic fx-* usage does not pay for them.

import {
  installOfflineSupport,
  pendingCount,
  clearOfflineQueue,
  flush as flushOffline,
} from './core/offline.js';
import { uploadPlugin } from './plugins/upload.js';
import { optimisticPlugin } from './plugins/optimistic.js';
import { resolveHtmx } from './core/startup.js';

export { uploadPlugin, optimisticPlugin, pendingCount, clearOfflineQueue };

let installed = false;

/** Installs offline request interception (fx-offline). Idempotent; returns a teardown. */
export function installNet(): () => void {
  if (installed || typeof document === 'undefined') return () => {};
  installed = true;
  const teardown = installOfflineSupport(() => resolveHtmx());
  return () => {
    installed = false;
    teardown();
  };
}

export const offline = {
  get pending() {
    return pendingCount();
  },
  flush: () => flushOffline(resolveHtmx()),
  clear: clearOfflineQueue,
};

export default { install: installNet, uploadPlugin, optimisticPlugin, offline };
