import './setup.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { installDeduplication } from '../../src/core/dedupe.js';
import { installRetrySupport } from '../../src/core/retry.js';
import { installValidation } from '../../src/core/validation.js';
import { installOpenController } from '../../src/components/components.js';
import { optimisticPlugin } from '../../src/plugins/optimistic.js';
import { applyPrefetch } from '../../src/presets/prefetch.js';
import { cache } from '../../src/cache/instance.js';

// Regression coverage for the 2.0 audit fixes: retry header loss, dedupe key deadlock,
// validation/confirm-dialog interaction, optimistic rollback defaults, and prefetch
// pipeline fidelity.

function makeEl(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as HTMLElement;
}

function configRequest(elt: Element, request: Record<string, unknown>): CustomEvent {
  return new CustomEvent('htmx:config:request', {
    bubbles: true,
    detail: { ctx: { sourceElement: elt, target: elt, request } },
  });
}

function beforeRequest(elt: Element, request: Record<string, unknown>): CustomEvent {
  return new CustomEvent('htmx:before:request', {
    bubbles: true,
    detail: { ctx: { sourceElement: elt, target: elt, request } },
  });
}

function afterRequest(elt: Element, ctx: Record<string, unknown>): CustomEvent {
  return new CustomEvent('htmx:after:request', { bubbles: true, detail: { ctx } });
}

describe('retry preserves request headers', () => {
  beforeEach(() => {
    Flux.dispose();
    document.body.innerHTML = '';
  });

  it('retries carry the original headers (CSRF included) plus X-Flux-Retry', () => {
    vi.useFakeTimers();
    const ajax = vi.fn();
    const w = window as unknown as { htmx?: unknown };
    const previous = w.htmx;
    w.htmx = { ajax };

    const retryTeardown = installRetrySupport();
    const el = makeEl('<button fx-retry="2" fx-retry-delay="1ms" hx-get="/data"></button>');
    document.body.append(el);

    const headers = new Headers({ 'X-CSRFToken': 'token-123', Accept: 'text/html' });
    el.dispatchEvent(configRequest(el, { method: 'GET', action: '/data', headers }));

    const failCtx: Record<string, unknown> = {
      sourceElement: el,
      target: el,
      request: { method: 'GET', action: '/data', headers },
      response: { status: 503 },
      text: 'nope',
    };
    el.dispatchEvent(afterRequest(el, failCtx));
    expect(failCtx.retryPending).toBe(true);

    vi.runAllTimers();
    expect(ajax).toHaveBeenCalledOnce();
    const merged = (ajax.mock.calls[0]?.[2] as { headers: Record<string, string> }).headers;
    // A Headers instance used to spread into {} — losing CSRF on every retry. Header
    // names arrive lowercased, exactly as a Headers iteration produces them.
    expect(merged['x-csrftoken']).toBe('token-123');
    expect(merged['accept']).toBe('text/html');
    expect(merged['X-Flux-Retry']).toBe('true');

    retryTeardown();
    w.htmx = previous;
    vi.useRealTimers();
  });
});

describe('dedupe in-flight deadline', () => {
  beforeEach(() => {
    Flux.dispose();
    document.body.innerHTML = '';
  });

  it('releases the key when the leader never completes, freeing later requests', () => {
    vi.useFakeTimers();
    const dedupeTeardown = installDeduplication();
    const leader = makeEl('<button fx-dedupe="true" hx-get="/feed"></button>');
    const next = makeEl('<button fx-dedupe="true" hx-get="/feed"></button>');
    document.body.append(leader, next);

    const leaderAbort = vi.fn();
    leader.dispatchEvent(
      configRequest(leader, { method: 'GET', action: '/feed', headers: {}, abort: leaderAbort }),
    );
    expect(leaderAbort).not.toHaveBeenCalled();

    // Leader dies without any after:request (page hide, exception). After the 30s
    // deadline the next request must be a fresh leader, not an aborted follower.
    vi.advanceTimersByTime(31_000);

    const nextAbort = vi.fn();
    next.dispatchEvent(
      configRequest(next, { method: 'GET', action: '/feed', headers: {}, abort: nextAbort }),
    );
    expect(nextAbort).not.toHaveBeenCalled();

    dedupeTeardown();
    vi.useRealTimers();
  });
});

describe('invalid form never opens the confirm dialog', () => {
  beforeEach(() => {
    Flux.dispose();
    document.body.innerHTML = '';
  });

  it('validation drop short-circuits the fx-confirm-dialog controller', () => {
    installValidation();
    const openTeardown = installOpenController();

    const form = makeEl(
      '<form fx-validate><button id="sub" fx-confirm-dialog="#dlg">Go</button></form>',
    ) as HTMLFormElement;
    form.reportValidity = vi.fn(() => false);
    const dialog = makeEl('<dialog id="dlg"><button data-flux-confirm>OK</button></dialog>');
    const showModal = vi.fn();
    (dialog as HTMLDialogElement).showModal = showModal;
    document.body.append(form, dialog);

    const evt = new CustomEvent('htmx:confirm', {
      bubbles: true,
      cancelable: true,
      detail: {
        elt: document.querySelector('#sub'),
        ctx: { sourceElement: document.querySelector('#sub') },
        issueRequest: vi.fn(),
        dropRequest: vi.fn(),
      },
    });
    document.dispatchEvent(evt);

    expect(showModal).not.toHaveBeenCalled();
    expect(evt.detail.issueRequest).not.toHaveBeenCalled();

    openTeardown();
  });
});

describe('optimistic rollback defaults', () => {
  beforeEach(() => {
    Flux.dispose();
    document.body.innerHTML = '';
  });

  it('rolls back an ancestor row on failure without fx-rollback opt-in', () => {
    Flux.configure();
    Flux.use(optimisticPlugin);

    // Real table markup: a stray <tr> outside a table gets dropped by the parser.
    const table = makeEl(
      '<table><tbody><tr id="row-x" fx-optimistic-remove="closest tr"><td><button id="row-btn">x</button></td></tr></tbody></table>',
    );
    document.body.appendChild(table);
    const row = document.querySelector('#row-x')!;
    const btn = document.querySelector('#row-btn')!;
    expect(row.isConnected).toBe(true);

    btn.dispatchEvent(beforeRequest(btn, { method: 'POST', action: '/rows/1' }));
    // Optimistic removal happened (keyed by the request SOURCE, an ancestor trigger)...
    expect(row.isConnected).toBe(false);

    const failCtx: Record<string, unknown> = {
      sourceElement: btn,
      request: { method: 'POST', action: '/rows/1' },
      response: { status: 500 },
    };
    btn.dispatchEvent(afterRequest(btn, failCtx));
    // ...and rollback is the default, restoring the removed row.
    expect(row.isConnected).toBe(true);
  });
});

describe('prefetch goes through the request conventions', () => {
  beforeEach(() => {
    Flux.dispose();
    document.body.innerHTML = '';
    cache.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cache key includes parameters and headers carry the htmx request context', async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="pf-token" />';
    Flux.configure({ csrf: { strategy: 'meta', headerName: 'X-CSRFToken' } });

    const fetchMock = vi.fn(
      () =>
        Promise.resolve(
          new Response('<div>ok</div>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
        ) as unknown as Response,
    );
    vi.stubGlobal('fetch', fetchMock);

    const el = makeEl(
      '<button hx-get="/list" hx-target="#list" hx-vals=\'{"page":2}\' fx-prefetch></button>',
    );
    document.body.append(el);
    expect(applyPrefetch(el, { url: '/list' })).toBe(true);

    el.dispatchEvent(new MouseEvent('mouseenter'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string>; credentials: RequestCredentials },
    ];
    expect(url).toBe('/list');
    expect(init.headers['HX-Target']).toBe('#list');
    expect(init.headers['HX-Request']).toBe('true');
    // GET carries no CSRF header — exactly what the real pipeline sends.
    expect(init.headers['X-CSRFToken']).toBeUndefined();
    // The prefetch key must match what a real request (which carries page=2) computes.
    await vi.waitFor(() =>
      expect(cache.get('GET:/list?page=2', { allowStale: true })).toBe('<div>ok</div>'),
    );
  });
});
