// Optional Alpine.js adapter. Registered only when the consumer passes an Alpine instance:
//
//   import Alpine from 'alpinejs';
//   import { registerAlpine } from './alpine.js';
//   registerAlpine(Alpine);   // before Alpine.start()
//   Alpine.start();
//
// Responsibilities: register shared stores (toast queue), and re-initialise Alpine on HTMX-
// swapped subtrees so x-* directives in fragments come alive without double-initialisation.

type AlpineLike = {
  data?(name: string, factory: () => unknown): void;
  store(name: string, value: unknown): void;
  initTree(node: Element): void;
  start(): void;
  plugin?(cb: (alpine: AlpineLike) => void): void;
};

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let registered = false;
let teardown: (() => void) | null = null;

/**
 * Wires Flux to an Alpine instance. Registers the shared toast store and ensures HTMX-swapped
 * content is initialised exactly once. Returns a cleanup disposer function.
 */
export function registerAlpine(Alpine: AlpineLike): () => void {
  if (registered && teardown) return teardown;
  if (typeof document === 'undefined') return () => {};

  registerToastStore(Alpine);

  // HTMX fires htmx:after:process once a subtree has been processed. Initialise Alpine on it;
  // Guard with data-flux-alpine-init attribute to prevent double-initialisation loops.
  const onAfterProcess = (evt: Event) => {
    const target = (evt as CustomEvent).target;
    if (target instanceof Element) {
      if (target.hasAttribute('data-flux-alpine-init')) return;
      target.setAttribute('data-flux-alpine-init', '1');
      Alpine.initTree(target);
    }
  };
  document.addEventListener('htmx:after:process', onAfterProcess);

  registered = true;
  teardown = () => {
    document.removeEventListener('htmx:after:process', onAfterProcess);
    registered = false;
    teardown = null;
  };
  return teardown;
}

export function disposeAlpine(): void {
  teardown?.();
  teardown = null;
}

export interface ToastStore {
  items: ToastItem[];
  push(message: string, type: ToastItem['type'], ttlMs?: number): number;
  success(message: string, ttlMs?: number): number;
  error(message: string, ttlMs?: number): number;
  dismiss(id: number): void;
  clear(): void;
}

/** Shared toast queue, accessible via Alpine.store('fluxToast'). */
export function registerToastStore(Alpine: AlpineLike): void {
  let nextId = 1;
  const store: ToastStore = {
    items: [],
    push(message, type, ttlMs = 4000) {
      const id = nextId++;
      store.items.push({ id, message, type });
      if (ttlMs > 0) setTimeout(() => store.dismiss(id), ttlMs);
      return id;
    },
    success(message, ttlMs) {
      return store.push(message, 'success', ttlMs);
    },
    error(message, ttlMs) {
      return store.push(message, 'error', ttlMs);
    },
    dismiss(id) {
      store.items = store.items.filter((i) => i.id !== id);
    },
    clear() {
      store.items = [];
    },
  };
  Alpine.store('fluxToast', store);
}

/** Test-only reset. */
export function resetAlpineForTests(): void {
  disposeAlpine();
}
