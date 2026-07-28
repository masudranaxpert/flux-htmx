import { describe, expect, it, vi, beforeEach } from 'vitest';
import { registerAlpine, resetAlpineForTests, type ToastStore } from '../../src/adapters/alpine.js';

// Minimal Alpine mock capturing store() calls and recording initTree targets.
function mockAlpine() {
  const stores = new Map<string, unknown>();
  const inited: Element[] = [];
  return {
    store(name: string, value: unknown) {
      stores.set(name, value);
    },
    getStore(name: string): unknown {
      return stores.get(name);
    },
    initTree(node: Element) {
      inited.push(node);
    },
    start() {},
    inited,
  };
}

describe('registerAlpine — toast store', () => {
  beforeEach(() => {
    resetAlpineForTests();
  });

  it('registers a fluxToast store with push/success/error/dismiss/clear', () => {
    const alpine = mockAlpine();
    registerAlpine(alpine);
    const store = alpine.getStore('fluxToast') as ToastStore;
    expect(store).toBeDefined();
    expect(store.items).toEqual([]);

    store.success('saved');
    store.error('failed');
    expect(store.items).toHaveLength(2);
    expect(store.items[0]).toMatchObject({ message: 'saved', type: 'success' });
    expect(store.items[1]).toMatchObject({ message: 'failed', type: 'error' });
  });

  it('dismiss removes a toast by id', () => {
    const alpine = mockAlpine();
    registerAlpine(alpine);
    const store = alpine.getStore('fluxToast') as ToastStore;
    const id = store.push('x', 'info', 0);
    expect(store.items).toHaveLength(1);
    store.dismiss(id);
    expect(store.items).toHaveLength(0);
  });

  it('clear empties the queue', () => {
    const alpine = mockAlpine();
    registerAlpine(alpine);
    const store = alpine.getStore('fluxToast') as ToastStore;
    store.push('a', 'info', 0);
    store.push('b', 'info', 0);
    store.clear();
    expect(store.items).toHaveLength(0);
  });

  it('initialises Alpine on HTMX-swapped subtrees', () => {
    const alpine = mockAlpine();
    registerAlpine(alpine);
    const swapped = document.createElement('div');
    swapped.innerHTML = '<div x-data="{}"></div>';
    document.body.appendChild(swapped);

    swapped.dispatchEvent(new CustomEvent('htmx:after:process', { bubbles: true }));

    expect(alpine.inited).toContain(swapped);
  });

  it('auto-dismisses after the ttl', () => {
    vi.useFakeTimers();
    const alpine = mockAlpine();
    registerAlpine(alpine);
    const store = alpine.getStore('fluxToast') as ToastStore;
    store.push('temp', 'info', 1000);
    expect(store.items).toHaveLength(1);
    vi.advanceTimersByTime(1001);
    expect(store.items).toHaveLength(0);
    vi.useRealTimers();
  });
});
