import './setup.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Flux from '../../src/flux.js';
import { pendingCount, clearOfflineQueue } from '../../src/core/offline.js';

describe('fx-offline: Offline Request Queue', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    document.body.innerHTML = '';
    clearOfflineQueue();
    Flux.configure();
  });

  afterEach(() => {
    clearOfflineQueue();
    // Restore navigator.onLine to true
    Object.defineProperty(navigator, 'onLine', {
      get: () => true,
      configurable: true,
    });
  });

  it('queues request when navigator is offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      get: () => false,
      configurable: true,
    });

    const el = document.createElement('button');
    el.setAttribute('fx-offline', '');
    document.body.appendChild(el);

    let prevented = false;
    const beforeReq = new CustomEvent('htmx:before:request', {
      bubbles: true,
      cancelable: true,
      detail: {
        elt: el,
        ctx: { request: { method: 'post', action: '/api/save', parameters: { name: 'John' } } },
      },
    });
    beforeReq.preventDefault = () => {
      prevented = true;
    };

    document.dispatchEvent(beforeReq);

    expect(prevented).toBe(true);
    expect(pendingCount()).toBe(1);
  });

  it('does NOT queue request when navigator is online', () => {
    Object.defineProperty(navigator, 'onLine', {
      get: () => true,
      configurable: true,
    });

    const el = document.createElement('button');
    el.setAttribute('fx-offline', '');
    document.body.appendChild(el);

    const beforeReq = new CustomEvent('htmx:before:request', {
      bubbles: true,
      cancelable: true,
      detail: {
        elt: el,
        ctx: { request: { method: 'post', action: '/api/save', parameters: {} } },
      },
    });
    document.dispatchEvent(beforeReq);

    expect(pendingCount()).toBe(0);
  });

  it('does NOT queue request for elements without fx-offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      get: () => false,
      configurable: true,
    });

    const el = document.createElement('button');
    // No fx-offline attribute
    document.body.appendChild(el);

    const beforeReq = new CustomEvent('htmx:before:request', {
      bubbles: true,
      cancelable: true,
      detail: {
        elt: el,
        ctx: { request: { method: 'post', action: '/api/save', parameters: {} } },
      },
    });
    document.dispatchEvent(beforeReq);

    expect(pendingCount()).toBe(0);
  });

  it('emits flux:offline:queued event when queuing', () => {
    Object.defineProperty(navigator, 'onLine', {
      get: () => false,
      configurable: true,
    });

    const el = document.createElement('button');
    el.setAttribute('fx-offline', '');
    document.body.appendChild(el);

    let queuedEvent: any = null;
    document.addEventListener(
      'flux:offline:queued',
      (e) => {
        queuedEvent = e;
      },
      { once: true },
    );

    const beforeReq = new CustomEvent('htmx:before:request', {
      bubbles: true,
      cancelable: true,
      detail: {
        elt: el,
        ctx: { request: { method: 'post', action: '/api/save', parameters: { foo: 'bar' } } },
      },
    });
    beforeReq.preventDefault = () => {};
    document.dispatchEvent(beforeReq);

    expect(queuedEvent).not.toBeNull();
    expect((queuedEvent as CustomEvent).detail.url).toBe('/api/save');
    expect((queuedEvent as CustomEvent).detail.params.foo).toBe('bar');
  });

  it('clearOfflineQueue removes all pending entries', () => {
    Object.defineProperty(navigator, 'onLine', {
      get: () => false,
      configurable: true,
    });

    const el = document.createElement('button');
    el.setAttribute('fx-offline', '');
    document.body.appendChild(el);

    const makeEvt = () => {
      const e = new CustomEvent('htmx:before:request', {
        bubbles: true,
        cancelable: true,
        detail: { elt: el, ctx: { request: { method: 'post', action: '/api/x', parameters: {} } } },
      });
      e.preventDefault = () => {};
      return e;
    };

    document.dispatchEvent(makeEvt());
    document.dispatchEvent(makeEvt());
    expect(pendingCount()).toBe(2);

    clearOfflineQueue();
    expect(pendingCount()).toBe(0);
  });
});
