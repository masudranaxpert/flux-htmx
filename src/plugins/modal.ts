// DEPRECATED shim: the fx-modal / fx-drawer backdrop handling moved into the core
// dialog controller (src/components/components.ts) so both the core IIFE and the full
// bundle share one canonical modal path — <dialog fx-modal> + fx-open / fx-close.
// installModal() remains for backwards compatibility and is a harmless no-op.
export function installModal(): () => void {
  return () => {};
}
