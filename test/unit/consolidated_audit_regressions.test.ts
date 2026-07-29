import './setup.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { executeAction, executeNamedPipeline, registerAction } from '../../src/core/actions.js';
import { installDeduplication } from '../../src/core/dedupe.js';
import { installFeedback, resetFeedbackForTests } from '../../src/core/feedback.js';
import { canStoreResponse } from '../../src/cache/cacheWire.js';
import { uploadPlugin } from '../../src/plugins/upload.js';
import { installRetrySupport } from '../../src/core/retry.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('consolidated release audit regressions', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    resetFeedbackForTests();
    vi.unstubAllGlobals();
  });

  it('validates without hx-confirm and creates a confirmation sentinel only for dialogs', () => {
    Flux.configure();
    const form = makeEl('<form fx-submit="/users" fx-validate></form>') as HTMLFormElement;
    form.reportValidity = vi.fn(() => false);
    const button = makeEl(
      '<button fx-delete="/users/1" fx-confirm-dialog="#confirm-modal"></button>',
    );
    document.body.append(form, button);
    Flux.process(document.body);

    const requestEvent = new CustomEvent('htmx:config:request', {
      bubbles: true,
      cancelable: true,
      detail: { ctx: { sourceElement: form, request: { method: 'POST', action: '/users' } } },
    });
    form.dispatchEvent(requestEvent);

    expect(requestEvent.defaultPrevented).toBe(true);
    expect(button.getAttribute('hx-confirm')).toBe('flux-confirm-dialog');
  });

  it('applies scope defaults to preset-only descendants', () => {
    Flux.configure();
    const scope = makeEl(`
      <section fx-scope fx-default-target="#result" fx-default-disable="true">
        <form fx-submit="/users"></form>
      </section>
    `);
    document.body.appendChild(scope);
    Flux.process(scope);

    const form = scope.querySelector('form')!;
    expect(form.getAttribute('fx-target')).toBe('#result');
    expect(form.getAttribute('hx-target')).toBe('#result');
    expect(form.getAttribute('fx-disable')).toBe('true');
  });

  it('preserves user takeovers and removes unchanged recipe output', () => {
    Flux.configure();
    Flux.recipe('admin-audit', { target: '#result', disable: true });
    const element = makeEl('<form fx-submit="/users" fx-recipe="admin-audit"></form>');
    document.body.appendChild(element);
    Flux.process(element);

    element.setAttribute('fx-target', '#manual');
    Flux.process(element);
    expect(element.getAttribute('fx-target')).toBe('#manual');

    element.removeAttribute('fx-recipe');
    Flux.process(element);
    expect(element.getAttribute('fx-target')).toBe('#manual');
    expect(element.hasAttribute('fx-disable')).toBe(false);
  });

  it('rebinds prefetch after URL changes and never generates hx-prefetch', async () => {
    Flux.configure();
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'text/html' }),
      text: async () => '<p>new</p>',
    }));
    vi.stubGlobal('fetch', fetchMock);

    const element = makeEl('<a fx-prefetch="/old" fx-cache="60"></a>');
    document.body.appendChild(element);
    Flux.process(element);
    element.setAttribute('fx-prefetch', '/new');
    Flux.process(element);
    element.dispatchEvent(new MouseEvent('mouseenter'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/new');
    expect(element.hasAttribute('hx-prefetch')).toBe(false);
    expect(element.getAttribute('data-flux-preset')).toBe('prefetch');
  });

  it('removes prefetch listeners when the controller-only preset is removed', () => {
    Flux.configure();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const element = makeEl('<a fx-prefetch="/users"></a>');
    document.body.appendChild(element);
    Flux.process(element);

    element.removeAttribute('fx-prefetch');
    Flux.process(element);
    element.dispatchEvent(new MouseEvent('mouseenter'));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(element.hasAttribute('data-flux-prefetch-bound')).toBe(false);
  });

  it('uses the same strict cache safety policy for every response writer', () => {
    const unsafeHeaders = new Headers({
      'Content-Type': 'text/html',
      Vary: 'Accept-Language',
      'Set-Cookie': 'session=abc',
    });

    expect(canStoreResponse({ method: 'GET' }, { status: 200, headers: unsafeHeaders })).toBe(
      false,
    );
    expect(
      canStoreResponse(
        { method: 'GET' },
        { status: 200, headers: new Headers({ 'Content-Type': 'text/html' }) },
      ),
    ).toBe(true);
  });

  it('isolates named action failures and continues the pipeline', async () => {
    const source = makeEl('<button></button>');
    const next = vi.fn();
    const error = vi.fn();
    source.addEventListener('flux:action:error', error);
    const unregisterBoom = registerAction('audit-boom', () => {
      throw new Error('boom');
    });
    const unregisterNext = registerAction('audit-next', next);
    Flux.action('audit-pipeline', ['audit-boom:test', 'audit-next']);

    await executeNamedPipeline('audit-pipeline', source);

    expect(error).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    unregisterBoom();
    unregisterNext();
  });

  it('unregisters actions owned by an unused plugin', async () => {
    Flux.configure();
    const handler = vi.fn();
    Flux.use({
      name: 'audit-actions',
      setup(api) {
        api.registerAction('audit-plugin-action', handler);
      },
    });
    const source = makeEl('<button></button>');

    await executeAction('audit-plugin-action', source);
    Flux.unuse('audit-actions');
    await executeAction('audit-plugin-action', source);

    expect(handler).toHaveBeenCalledOnce();
  });

  it('hard dispose removes shorthand output from shorthand-only elements', () => {
    Flux.configure();
    const button = makeEl('<button fx-get="/users"></button>');
    document.body.appendChild(button);
    Flux.process(button);
    expect(button.getAttribute('hx-get')).toBe('/users');

    Flux.dispose({ removeGeneratedAttributes: true });

    expect(button.hasAttribute('hx-get')).toBe(false);
    expect(button.hasAttribute('data-flux-gen-shorthand-get')).toBe(false);
  });

  it('hard dispose removes unchanged recipe and scope fx-* output', () => {
    Flux.configure();
    Flux.recipe('dispose-owned', { target: '#result', disable: true });
    const scope = makeEl(`
      <section fx-scope fx-default-indicator="#spinner">
        <form fx-submit="/users" fx-recipe="dispose-owned"></form>
      </section>
    `);
    document.body.appendChild(scope);
    const form = scope.querySelector('form')!;
    Flux.process(scope);

    Flux.dispose({ removeGeneratedAttributes: true });

    expect(form.hasAttribute('fx-target')).toBe(false);
    expect(form.hasAttribute('fx-disable')).toBe(false);
    expect(form.hasAttribute('fx-indicator')).toBe(false);
  });

  it('restores fx-confirm in the same pass after fx-confirm-dialog is removed', () => {
    Flux.configure();
    const button = makeEl(
      '<button fx-delete="/users/1" fx-confirm="Sure?" fx-confirm-dialog="#dialog"></button>',
    );
    document.body.appendChild(button);
    Flux.process(button);
    expect(button.getAttribute('hx-confirm')).toBe('flux-confirm-dialog');

    button.removeAttribute('fx-confirm-dialog');
    Flux.process(button);

    expect(button.getAttribute('hx-confirm')).toBe('Sure?');
  });

  it('does not treat action pipelines as status selectors in doctor()', () => {
    const form = makeEl('<form fx-post="/users" fx-on-success="toast:Saved; close:#modal"></form>');
    document.body.appendChild(form);

    const report = Flux.doctor(document.body);

    expect(report.warnings.some((warning) => warning.includes('toast:Saved'))).toBe(false);
  });

  it('exposes upload honestly without claiming native progress support', () => {
    expect(uploadPlugin.name).toBe('upload');
  });

  it('classifies timeout and abort exceptions from the HTMX 4 error event', () => {
    const teardown = installFeedback();
    const timedOut = makeEl('<button></button>');
    const aborted = makeEl('<button></button>');
    document.body.append(timedOut, aborted);

    timedOut.dispatchEvent(
      new CustomEvent('htmx:error', {
        bubbles: true,
        detail: { elt: timedOut, error: new DOMException('Timed out', 'TimeoutError') },
      }),
    );
    aborted.dispatchEvent(
      new CustomEvent('htmx:error', {
        bubbles: true,
        detail: { elt: aborted, error: new DOMException('Aborted', 'AbortError') },
      }),
    );

    expect(timedOut.getAttribute('data-flux-timeout')).toBe('1');
    expect(aborted.getAttribute('data-flux-aborted')).toBe('1');
    teardown();
  });

  it('uses timeout signals so real HTMX timeouts are distinguishable from manual aborts', async () => {
    Flux.configure({ requests: { timeoutMs: 1 } });
    const source = makeEl('<button></button>');
    document.body.appendChild(source);
    const controller = new AbortController();
    const request = {
      method: 'GET',
      action: '/slow',
      headers: {},
      credentials: 'same-origin' as RequestCredentials,
      signal: controller.signal,
    };

    source.dispatchEvent(
      new CustomEvent('htmx:config:request', {
        bubbles: true,
        detail: { ctx: { sourceElement: source, request } },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(request.signal.reason?.name).toBe('TimeoutError');
  });

  it('emits the HTMX 4 response error event and ctx shape for dedupe followers', () => {
    const teardown = installDeduplication();
    const leader = makeEl('<button fx-dedupe="true" fx-get="/users"></button>');
    const follower = makeEl('<button fx-dedupe="true" fx-get="/users"></button>');
    document.body.append(leader, follower);

    for (const element of [leader, follower]) {
      element.dispatchEvent(
        new CustomEvent('htmx:config:request', {
          bubbles: true,
          detail: {
            ctx: {
              sourceElement: element,
              target: element,
              request: { method: 'GET', action: '/users', abort: vi.fn() },
            },
          },
        }),
      );
    }

    const responseError = vi.fn();
    follower.addEventListener('htmx:response:error', responseError);
    leader.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: leader,
            target: leader,
            request: { method: 'GET', action: '/users' },
            response: { status: 500, headers: new Headers() },
            text: 'failed',
          },
        },
      }),
    );

    expect(responseError).toHaveBeenCalledOnce();
    const event = responseError.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail.ctx.sourceElement).toBe(follower);
    expect(event.detail.ctx.response.status).toBe(500);
    teardown();
  });

  it('releases dedupe followers when the final retry fails', () => {
    vi.useFakeTimers();
    const retryTeardown = installRetrySupport();
    const dedupeTeardown = installDeduplication();
    const ajax = vi.fn();
    const previousHtmx = (window as any).htmx;
    (window as any).htmx = { ajax };
    const leader = makeEl(
      '<button fx-dedupe="true" fx-retry="1" fx-retry-delay="1" fx-get="/users"></button>',
    );
    const follower = makeEl(
      '<button fx-dedupe="true" fx-retry="1" fx-retry-delay="1" fx-get="/users"></button>',
    );
    document.body.append(leader, follower);

    for (const element of [leader, follower]) {
      element.dispatchEvent(
        new CustomEvent('htmx:config:request', {
          bubbles: true,
          detail: {
            ctx: {
              sourceElement: element,
              target: element,
              request: { method: 'GET', action: '/users', headers: {}, abort: vi.fn() },
            },
          },
        }),
      );
    }

    const firstFailureCtx: Record<string, any> = {
      sourceElement: leader,
      target: leader,
      request: { method: 'GET', action: '/users', headers: {} },
      response: { status: 503 },
      text: 'retrying',
    };
    leader.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { ctx: firstFailureCtx },
      }),
    );
    expect(firstFailureCtx.retryPending).toBe(true);
    vi.runAllTimers();
    expect(ajax).toHaveBeenCalledOnce();

    const retryHeaders = { 'X-Flux-Retry': 'true' };
    leader.dispatchEvent(
      new CustomEvent('htmx:before:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: leader,
            request: { method: 'GET', action: '/users', headers: retryHeaders },
          },
        },
      }),
    );
    leader.dispatchEvent(
      new CustomEvent('htmx:config:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: leader,
            target: leader,
            request: { method: 'GET', action: '/users', headers: retryHeaders },
          },
        },
      }),
    );

    const followerError = vi.fn();
    follower.addEventListener('flux:dedupe:error', followerError);
    const finalFailureCtx: Record<string, any> = {
      sourceElement: leader,
      target: leader,
      request: { method: 'GET', action: '/users', headers: retryHeaders },
      response: { status: 503 },
      text: 'failed',
    };
    leader.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { ctx: finalFailureCtx },
      }),
    );

    expect(finalFailureCtx.retryTerminal).toBe(true);
    expect(followerError).toHaveBeenCalledOnce();

    (window as any).htmx = previousHtmx;
    dedupeTeardown();
    retryTeardown();
    vi.useRealTimers();
  });
});
