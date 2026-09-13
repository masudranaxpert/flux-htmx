import './setup.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { FragmentCache } from '../../src/cache/cache.js';
import {
  cacheKey,
  canStoreResponse,
  getCachePolicy,
  installCacheIntegration,
} from '../../src/cache/cacheWire.js';
import { cache } from '../../src/cache/instance.js';
import { applySubmit } from '../../src/presets/submit.js';
import { registerAction } from '../../src/core/actions.js';
import {
  collectRules,
  disposeStatusTargeting,
  wireStatusTargeting,
} from '../../src/core/status.js';
import {
  installFeedback,
  resetFeedbackForTests,
  setLoadingState,
  setRequestState,
} from '../../src/core/feedback.js';
import { getGeneratedAttributes } from '../../src/core/generated-attributes.js';
import { getRetryOptions, installRetrySupport } from '../../src/core/retry.js';
import { installDeduplication } from '../../src/core/dedupe.js';
import { getRequestContext } from '../../src/core/events.js';
import { readCookie } from '../../src/core/csrf.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

function configRequest(elt: Element, request: Record<string, unknown>): CustomEvent {
  return new CustomEvent('htmx:config:request', {
    bubbles: true,
    detail: { ctx: { sourceElement: elt, target: elt, request } },
  });
}

function afterRequest(elt: Element, ctx: Record<string, unknown>): CustomEvent {
  return new CustomEvent('htmx:after:request', { bubbles: true, detail: { ctx } });
}

describe('status targeting (fx-on-<code>)', () => {
  it('collects every fx-on-* attribute', () => {
    const el = makeEl(
      '<form fx-submit="/u" fx-on-422="#errors" fx-on-409="#conflict" fx-on-500="#server"></form>',
    );
    const rules = collectRules(el);
    expect(rules.get(422)).toBe('#errors');
    expect(rules.get(409)).toBe('#conflict');
    expect(rules.get(500)).toBe('#server');
  });

  it('ignores non-numeric codes and empty values', () => {
    const el = makeEl('<form fx-on-422="#errors" fx-on-abc="#x" fx-on-500=""></form>');
    const rules = collectRules(el);
    expect(rules.size).toBe(1);
    expect(rules.has(422)).toBe(true);
  });

  it('returns empty for an element with no fx-on-*', () => {
    expect(collectRules(makeEl('<form fx-submit="/u"></form>')).size).toBe(0);
  });
});

describe('status attribute compilation and rewiring', () => {
  it('Native HTMX 4 status target attribute compilation (hx-status:422)', () => {
    const el = makeEl('<button fx-post="/save" fx-on-422="#errors">Save</button>');
    document.body.appendChild(el);
    wireStatusTargeting(el);
    expect(el.getAttribute('hx-status:422')).toBe(JSON.stringify({ target: '#errors' }));
  });

  it('Compiles canonical hx-status:422 attribute for HTMX 4 compatibility', () => {
    const btn = makeEl('<button fx-post="/save" fx-on-422="#errors">Save</button>');
    document.body.appendChild(btn);
    wireStatusTargeting(btn);

    expect(btn.getAttribute('hx-status:422')).toBe(JSON.stringify({ target: '#errors' }));
  });

  it('skips setting hx-status:<code> attribute when CSS selector syntax is invalid', () => {
    const el = makeEl('<button fx-on-422="[">Save</button>');
    document.body.appendChild(el);
    wireStatusTargeting(el);
    expect(el.hasAttribute('hx-status:422')).toBe(false);
  });

  it('warns on invalid CSS selector in fx-on-<code> without crashing', () => {
    const el = makeEl('<button fx-on-422="[">Save</button>');
    document.body.appendChild(el);
    expect(() => wireStatusTargeting(el)).not.toThrow();
    expect(el.hasAttribute('hx-status:422')).toBe(false);
  });

  it('Status fx-on-* runtime attribute modification rewires target', () => {
    const el = makeEl('<form fx-on-422="#old-errors"></form>');
    document.body.appendChild(el);
    wireStatusTargeting(el);
    expect(el.getAttribute('hx-status:422')).toBe('{"target":"#old-errors"}');

    el.setAttribute('fx-on-422', '#new-errors');
    wireStatusTargeting(el);
    expect(el.getAttribute('hx-status:422')).toBe('{"target":"#new-errors"}');
  });

  it('Preserves user-written hx-target-422 attribute during disposeStatusTargeting()', () => {
    const form = makeEl('<form fx-on-422="#errors" hx-target-422="#custom-errors"></form>');
    document.body.appendChild(form);
    wireStatusTargeting(form);

    disposeStatusTargeting();

    // User-written hx-target-422 attribute must be preserved!
    expect(form.getAttribute('hx-target-422')).toBe('#custom-errors');
  });

  it('Status targeting routes hx-status:* through generated attribute registry', () => {
    Flux.dispose();
    Flux.configure();

    const el = makeEl('<button fx-get="/test" fx-on-422="#err">Send</button>');
    document.body.appendChild(el);

    wireStatusTargeting(el);
    expect(el.getAttribute('hx-status:422')).toBe('{"target":"#err"}');
    expect(getGeneratedAttributes(el).has('hx-status:422')).toBe(true);

    Flux.dispose({ removeGeneratedAttributes: true });
    expect(el.hasAttribute('hx-status:422')).toBe(false);
  });
});

describe('action pipelines (fx-on-success)', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    document.body.innerHTML = '';
    Flux.configure();
  });

  it('executes inline pipeline on htmx:after:request if successful', async () => {
    const el = document.createElement('form');
    el.setAttribute('fx-on-success', 'custom1:foo; custom2');
    document.body.appendChild(el);

    const spy1 = vi.fn();
    const spy2 = vi.fn();
    registerAction('custom1', spy1);
    registerAction('custom2', spy2);

    const event = new CustomEvent('htmx:after:request', {
      bubbles: true,
      detail: { elt: el, successful: true, failed: false },
    });
    document.dispatchEvent(event);

    // Using setTimeout to wait for async pipeline execution
    await new Promise((r) => setTimeout(r, 10));

    expect(spy1).toHaveBeenCalledWith('foo', el, event.detail);
    expect(spy2).toHaveBeenCalledWith('', el, event.detail);
  });

  it('executes fx-on-error on failed request', async () => {
    const el = document.createElement('form');
    el.setAttribute('fx-on-error', 'customError:baz');
    document.body.appendChild(el);

    const spyError = vi.fn();
    registerAction('customError', spyError);

    const event = new CustomEvent('htmx:after:request', {
      bubbles: true,
      detail: { elt: el, successful: false, failed: true },
    });
    document.dispatchEvent(event);

    await new Promise((r) => setTimeout(r, 10));

    expect(spyError).toHaveBeenCalledWith('baz', el, event.detail);
  });

  it('built-in actions: close dialog', async () => {
    const dialog = document.createElement('dialog');
    dialog.id = 'my-dialog';
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);

    const el = document.createElement('button');
    el.setAttribute('fx-on-success', 'close:#my-dialog');
    document.body.appendChild(el);

    const event = new CustomEvent('htmx:after:request', {
      bubbles: true,
      detail: { elt: el, successful: true, failed: false },
    });
    document.dispatchEvent(event);

    await new Promise((r) => setTimeout(r, 10));
    console.log('Dialog in DOM?', document.getElementById('my-dialog') !== null);
    console.log('queryMany:', document.querySelectorAll('#my-dialog').length);
    expect(dialog.hasAttribute('open')).toBe(false);
  });
});

describe('cache keys and cache integration', () => {
  it('serializes input values into URL query parameters for distinct cache keys', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const input1 = makeEl('<input name="q" value="apple" fx-cache="60s" />');
    document.body.appendChild(input1);
    input1.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: input1,
            request: { method: 'GET', action: '/search', parameters: { q: 'apple' } },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Apple Results</div>',
        },
      }),
    );

    const input2 = makeEl('<input name="q" value="banana" fx-cache="60s" />');
    document.body.appendChild(input2);
    input2.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: input2,
            request: { method: 'GET', action: '/search', parameters: { q: 'banana' } },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Banana Results</div>',
        },
      }),
    );

    expect(cache.get('GET:/search?q=apple')).toBe('<div>Apple Results</div>');
    expect(cache.get('GET:/search?q=banana')).toBe('<div>Banana Results</div>');
  });

  it('sorts parameters alphabetically and omits password / csrf token fields', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl(`
      <form fx-get="/search" fx-cache="60s">
        <input name="b" value="2" />
        <input name="a" value="1" />
        <input type="password" name="password" value="secret123" />
        <input name="csrfmiddlewaretoken" value="token123" />
      </form>
    `);
    document.body.appendChild(form);

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            request: { method: 'GET', action: '/search' },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Sorted Search Results</div>',
        },
      }),
    );

    // Key stays alphabetical (a=1&b=2); sensitive values are hashed (~...) into the
    // key so it stays distinct per secret while never leaking the raw value.
    const key = cacheKey(form, { method: 'GET', action: '/search' });
    expect(key.startsWith('GET:/search?a=1&b=2&csrfmiddlewaretoken=%7E')).toBe(true);
    expect(key).toContain('password=%7E');
    expect(key).not.toContain('secret123');
    expect(key).not.toContain('token123');
    expect(cache.get(key)).toBe('<div>Sorted Search Results</div>');
  });

  it('GET form cache differentiation with sorted parameters', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl(`
      <form fx-get="/search" fx-cache="60s">
        <input name="b" value="2" />
        <input name="a" value="1" />
      </form>
    `);
    document.body.appendChild(form);

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            request: { method: 'GET', action: '/search' },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Sorted Search Output</div>',
        },
      }),
    );

    expect(cache.get('GET:/search?a=1&b=2')).toBe('<div>Sorted Search Output</div>');
  });

  it('fx-cache-vary explicit field whitelist isolation', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl(`
      <form fx-get="/search" fx-cache="60s" fx-cache-vary="q">
        <input name="q" value="apple" />
        <input name="ignored" value="123" />
      </form>
    `);
    document.body.appendChild(form);

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            request: { method: 'GET', action: '/search' },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Vary Query Output</div>',
        },
      }),
    );

    expect(cache.get('GET:/search?q=apple')).toBe('<div>Vary Query Output</div>');
  });

  it('merges existing URL query params with form inputs and filters sensitive fields across both', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl(`
      <form fx-get="/search?category=books&token=secret123" fx-cache="60s">
        <input name="q" value="python" />
        <input type="password" name="password" value="secret" />
      </form>
    `);
    document.body.appendChild(form);

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            request: { method: 'GET', action: '/search?category=books&token=secret123' },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Merged Query Results</div>',
        },
      }),
    );

    // Key merges query + form params; token/password are hashed, never verbatim.
    const key = cacheKey(form, {
      method: 'GET',
      action: '/search?category=books&token=secret123',
    });
    expect(key).toContain('category=books');
    expect(key).toContain('q=python');
    expect(key).not.toContain('secret123');
    expect(key).not.toContain('secret');
    expect(cache.get(key)).toBe('<div>Merged Query Results</div>');
    expect(
      cache.get('GET:/search?category=books&password=secret&q=python&token=secret123'),
    ).toBeNull();
  });

  it('Deduplicates canonical URL query parameters and form parameters', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl(`
      <form fx-get="/search?q=old" fx-cache="60s">
        <input name="q" value="new" />
      </form>
    `);
    document.body.appendChild(form);

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            request: { method: 'GET', action: '/search?q=old' },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Updated Results</div>',
        },
      }),
    );

    expect(cache.get('GET:/search?q=new')).toBe('<div>Updated Results</div>');
    expect(cache.get('GET:/search?q=new&q=old')).toBeNull();
  });

  it('Handles array parameters and unchecked standalone checkboxes in cache keys', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const cbUnchecked = makeEl(
      '<input type="checkbox" name="active" value="on" fx-get="/filter" fx-cache="60s" />',
    );
    document.body.appendChild(cbUnchecked);

    cbUnchecked.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: cbUnchecked,
            request: { method: 'GET', action: '/filter' },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Filtered Output</div>',
        },
      }),
    );

    // Unchecked checkbox value "on" must not be included in cache key
    expect(cache.get('GET:/filter')).toBe('<div>Filtered Output</div>');
    expect(cache.get('GET:/filter?active=on')).toBeNull();
  });

  it('Maps fx-cache="true" to default TTL 60s', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl('<form fx-get="/dashboard" fx-cache="true"></form>');
    document.body.appendChild(form);

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            request: { method: 'GET', action: '/dashboard' },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Dashboard HTML</div>',
        },
      }),
    );

    expect(cache.get('GET:/dashboard')).toBe('<div>Dashboard HTML</div>');
  });

  it('Empty fx-cache attribute returns default 60s TTL policy', () => {
    const el = makeEl('<div fx-cache></div>');
    const policy = getCachePolicy(el);
    expect(policy.enabled).toBe(true);
    expect(policy.ttl).toBe(60000);
  });

  it('blocks password and token fields from cache key even if listed in fx-cache-vary', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl(`
      <form fx-get="/login" fx-cache="60s" fx-cache-vary="q,password,token">
        <input name="q" value="apple" />
        <input type="password" name="password" value="secret" />
        <input name="token" value="123" />
      </form>
    `);
    document.body.appendChild(form);

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            request: { method: 'GET', action: '/login' },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Login Response</div>',
        },
      }),
    );

    // Even when fx-cache-vary lists them, password/token enter the key only as
    // hashes — raw secrets never appear, and each secret value gets its own entry.
    const key = cacheKey(form, { method: 'GET', action: '/login' });
    expect(key).toContain('q=apple');
    expect(key).toContain('password=%7E');
    expect(key).toContain('token=%7E');
    expect(key).not.toContain('secret');
    expect(key).not.toContain('password=secret');
    expect(cache.get(key)).toBe('<div>Login Response</div>');
    expect(cache.get('GET:/login?password=secret&q=apple')).toBeNull();
  });

  it('safely checks password input type for complex field names like items[0].password', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl(`
      <form fx-get="/items" fx-cache="60s">
        <input type="password" name="items[0].password" value="secret" />
        <input name="items[0].name" value="apple" />
      </form>
    `);
    document.body.appendChild(form);

    expect(() => {
      form.dispatchEvent(
        new CustomEvent('htmx:after:request', {
          bubbles: true,
          detail: {
            ctx: {
              sourceElement: form,
              request: { method: 'GET', action: '/items' },
              successful: true,
              response: { status: 200 },
            },
            text: '<div>Item Response</div>',
          },
        }),
      );
    }).not.toThrow();

    // Password input is hashed into the key; the plain param alone must miss.
    const stored = cacheKey(form, { method: 'GET', action: '/items' });
    expect(stored).toContain('items%5B0%5D.password=%7E');
    expect(stored).toContain('items%5B0%5D.name=apple');
    expect(cache.get(stored)).toBe('<div>Item Response</div>');
    expect(cache.get('GET:/items?items%5B0%5D.name=apple')).toBeNull();
  });

  it('Converts /users* invalidation pattern to GET:/users* to match stored keys', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    cache.set('GET:/users?page=1', '<div>Users Page 1</div>');
    expect(cache.get('GET:/users?page=1')).toBe('<div>Users Page 1</div>');

    const form = makeEl('<form fx-post="/users" fx-invalidate="/users*"></form>');
    document.body.appendChild(form);

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            request: { method: 'POST', action: '/users' },
            successful: true,
            response: { status: 200 },
          },
        },
      }),
    );

    // Cache entry must be invalidated
    expect(cache.get('GET:/users?page=1')).toBeNull();
  });

  it('Skips caching GET requests if request Authorization header is present', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl('<form fx-get="/profile" fx-cache="60s"></form>');
    document.body.appendChild(form);

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            request: {
              method: 'GET',
              action: '/profile',
              headers: { Authorization: 'Bearer secret_token' },
            },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Private Profile</div>',
        },
      }),
    );

    expect(cache.get('GET:/profile')).toBeNull();
  });

  it('Does not cache responses with Authorization header or non-HTML Content-Type', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl('<form fx-get="/api" fx-cache="60s"></form>');
    document.body.appendChild(form);

    // JSON response must be skipped
    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            request: { method: 'GET', action: '/api' },
            successful: true,
            response: { status: 200, headers: new Map([['content-type', 'application/json']]) },
          },
          text: '{"status":"ok"}',
        },
      }),
    );

    expect(cache.get('GET:/api')).toBeNull();
  });

  it('Honors hx-swap over fx-swap on cache hit', () => {
    const cache = new FragmentCache();
    const htmxMock = { swap: vi.fn() };
    installCacheIntegration(cache, htmxMock);

    const el = makeEl(
      '<div fx-get="/card" fx-cache="60s" hx-swap="outerHTML" fx-swap="innerHTML"></div>',
    );
    document.body.appendChild(el);

    cache.set('GET:/card', '<div>Cached Card</div>');

    el.dispatchEvent(
      new CustomEvent('htmx:config:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: el,
            target: el,
            request: { method: 'GET', action: '/card', abort: vi.fn() },
          },
        },
      }),
    );

    expect(htmxMock.swap).toHaveBeenCalledWith(
      expect.objectContaining({ swap: 'outerHTML', text: '<div>Cached Card</div>' }),
    );
  });

  it('serializes entire form inputs into GET query parameters for cache key', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl(`
      <form fx-get="/search" fx-cache="60s">
        <input name="q" value="apple" />
        <input name="page" value="1" />
      </form>
    `);
    document.body.appendChild(form);

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            request: { method: 'GET', action: '/search' },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Form Apple Results</div>',
        },
      }),
    );

    expect(cache.get('GET:/search?page=1&q=apple')).toBe('<div>Form Apple Results</div>');
  });

  it('distinguishes keys by method and full action URL with query params', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const source1 = makeEl('<div fx-cache="60s"></div>');
    document.body.appendChild(source1);
    source1.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: source1,
            request: { method: 'GET', action: '/search?q=apple' },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Apple Results</div>',
        },
      }),
    );

    const source2 = makeEl('<div fx-cache="60s"></div>');
    document.body.appendChild(source2);
    source2.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: source2,
            request: { method: 'GET', action: '/search?q=banana' },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Banana Results</div>',
        },
      }),
    );

    expect(cache.get('GET:/search?q=apple')).toBe('<div>Apple Results</div>');
    expect(cache.get('GET:/search?q=banana')).toBe('<div>Banana Results</div>');
  });

  it('respects uppercase or mixed-case Cache-Control: NO-STORE', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const source = makeEl('<div fx-cache="60s"></div>');
    document.body.appendChild(source);
    source.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: source,
            request: { method: 'GET', action: '/private' },
            xhr: {
              getResponseHeader: (name: string) =>
                name === 'Cache-Control' ? 'NO-STORE, PRIVATE' : null,
              status: 200,
            },
            successful: true,
          },
          text: '<div>Secret</div>',
        },
      }),
    );

    expect(cache.get('GET:/private')).toBeNull();
  });
});

describe('retry', () => {
  beforeEach(() => {
    Flux.dispose();
    document.body.innerHTML = '';
  });

  it('parses fx-retry options and calculates backoff', () => {
    const el = makeEl('<div fx-retry="3" fx-retry-delay="1s" fx-retry-backoff="2"></div>');
    const opts = getRetryOptions(el);
    expect(opts).not.toBeNull();
    expect(opts?.maxRetries).toBe(3);
    expect(opts?.delayMs).toBe(1000);
    expect(opts?.backoffFactor).toBe(2);
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

describe('dedupe', () => {
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

describe('request lifecycle regressions', () => {
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

  it('shares a successful leader retry with dedupe followers (leader-replacement is a no-op, no double swap)', () => {
    vi.useFakeTimers();
    const retryTeardown = installRetrySupport();
    const dedupeTeardown = installDeduplication();
    const ajax = vi.fn();
    const swap = vi.fn();
    // window.htmx is the dedupe/retry fallback instance; mock it for the test.
    const w = window as unknown as { htmx?: { ajax?: unknown; swap?: unknown } };
    const previousHtmx = w.htmx;
    w.htmx = { ajax, swap };

    // Leader owns the request AND declares fx-retry; follower is dedup'd onto it.
    const leader = makeEl(
      '<button fx-dedupe="true" fx-retry="1" fx-retry-delay="1" fx-get="/users"></button>',
    );
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
              request: { method: 'GET', action: '/users', headers: {}, abort: vi.fn() },
            },
          },
        }),
      );
    }

    // Leader fails → retry scheduled, dedupe entry kept (retryPending).
    const failCtx: Record<string, unknown> = {
      sourceElement: leader,
      target: leader,
      request: { method: 'GET', action: '/users', headers: {} },
      response: { status: 503 },
      text: 'x',
    };
    leader.dispatchEvent(
      new CustomEvent('htmx:after:request', { bubbles: true, detail: { ctx: failCtx } }),
    );
    expect(failCtx.retryPending).toBe(true);
    vi.runAllTimers();
    expect(ajax).toHaveBeenCalledOnce();

    // Retry request's config:request hits the isRetry branch: consumers[0] re-set to the same leader.
    const retryHeaders = { 'X-Flux-Retry': 'true' };
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

    const followerSuccess = vi.fn();
    follower.addEventListener('flux:dedupe:success', followerSuccess);

    // Retry SUCCEEDS → followers receive the payload via exactly one swap; leader not re-swapped by dedupe.
    const okCtx: Record<string, unknown> = {
      sourceElement: leader,
      target: leader,
      request: { method: 'GET', action: '/users', headers: retryHeaders },
      response: { status: 200 },
      text: '<p>ok</p>',
    };
    leader.dispatchEvent(
      new CustomEvent('htmx:after:request', { bubbles: true, detail: { ctx: okCtx } }),
    );

    expect(followerSuccess).toHaveBeenCalledOnce();
    expect(swap).toHaveBeenCalledTimes(1); // follower only; leader handled by its own ajax flow

    w.htmx = previousHtmx;
    dedupeTeardown();
    retryTeardown();
    vi.useRealTimers();
  });
});

describe('feedback state attributes', () => {
  it('removes data-flux-http-error and data-flux-network-error when a new request starts', () => {
    resetFeedbackForTests();
    installFeedback();

    const btn = makeEl('<button fx-get="/test">Fetch</button>');
    document.body.appendChild(btn);

    btn.setAttribute('data-flux-http-error', '500');
    btn.setAttribute('data-flux-network-error', '1');

    btn.dispatchEvent(
      new CustomEvent('htmx:before:request', {
        bubbles: true,
        detail: { ctx: { sourceElement: btn } },
      }),
    );

    expect(btn.hasAttribute('data-flux-http-error')).toBe(false);
    expect(btn.hasAttribute('data-flux-network-error')).toBe(false);
    expect(btn.getAttribute('data-flux-loading')).toBe('1');

    resetFeedbackForTests();
  });

  it('Offline and network error state attribute toggles', () => {
    resetFeedbackForTests();
    installFeedback();

    const btn = makeEl('<button fx-get="/items">Fetch</button>');
    document.body.appendChild(btn);

    // Simulate Network Error (status 0)
    btn.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { ctx: { sourceElement: btn, response: { status: 0 }, successful: false } },
      }),
    );

    expect(btn.getAttribute('data-flux-error')).toBe('1');
    expect(btn.getAttribute('data-flux-network-error')).toBe('1');
    expect(btn.hasAttribute('data-flux-http-error')).toBe(false);

    resetFeedbackForTests();
  });

  it('resets opposite error attributes when state transitions between network and http errors', () => {
    resetFeedbackForTests();
    installFeedback();

    const btn = makeEl('<button fx-get="/test">Fetch</button>');
    document.body.appendChild(btn);

    // Transition 1: HTTP 500
    btn.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { ctx: { sourceElement: btn, response: { status: 500 }, successful: false } },
      }),
    );
    expect(btn.getAttribute('data-flux-http-error')).toBe('500');
    expect(btn.hasAttribute('data-flux-network-error')).toBe(false);

    // Transition 2: Network Error (status 0)
    btn.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { ctx: { sourceElement: btn, response: { status: 0 }, successful: false } },
      }),
    );
    expect(btn.getAttribute('data-flux-network-error')).toBe('1');
    expect(btn.hasAttribute('data-flux-http-error')).toBe(false);

    resetFeedbackForTests();
  });

  describe('htmx:finally:request indicator balancing and data-flux-* state attributes', () => {
    it('toggles data-flux-loading and clears on finally:request', () => {
      resetFeedbackForTests();
      installFeedback();

      const source = makeEl('<button fx-get="/test">Fetch</button>');
      document.body.appendChild(source);

      // Real HTMX 4 passes the SAME ctx object to before:request and finally:request.
      const ctx = { sourceElement: source };
      const beforeEvt = new CustomEvent('htmx:before:request', {
        bubbles: true,
        detail: { ctx },
      });
      source.dispatchEvent(beforeEvt);

      expect(source.getAttribute('data-flux-loading')).toBe('1');

      const finallyEvt = new CustomEvent('htmx:finally:request', {
        bubbles: true,
        detail: { ctx },
      });
      source.dispatchEvent(finallyEvt);

      expect(source.hasAttribute('data-flux-loading')).toBe(false);
      resetFeedbackForTests();
    });

    it('keeps global indicator active when finally:request fires without a matching before:request (confirm-cancel)', () => {
      resetFeedbackForTests();
      const spinner = makeEl('<div id="global-spinner"></div>');
      document.body.appendChild(spinner);
      // Indicator selector resolved via flux-feedback meta — no config cast needed.
      const meta = makeEl('<meta name="flux-feedback" />') as HTMLMetaElement;
      meta.content = JSON.stringify({ indicator: '#global-spinner' });
      document.head.appendChild(meta);
      installFeedback();

      const sourceA = makeEl('<button fx-get="/a">A</button>');
      const sourceB = makeEl('<button fx-get="/b">B</button>');
      document.body.appendChild(sourceA);
      document.body.appendChild(sourceB);

      // Request A starts normally via before:request
      const ctxA = { sourceElement: sourceA };
      sourceA.dispatchEvent(
        new CustomEvent('htmx:before:request', { bubbles: true, detail: { ctx: ctxA } }),
      );
      expect(sourceA.getAttribute('data-flux-loading')).toBe('1');
      expect(spinner.hasAttribute('data-flux-active')).toBe(true);

      // Request B is dropped at htmx:confirm: finally:request fires with NO preceding before:request
      const ctxB = { sourceElement: sourceB };
      sourceB.dispatchEvent(
        new CustomEvent('htmx:finally:request', { bubbles: true, detail: { ctx: ctxB } }),
      );

      // A is still in flight: indicator and A's loading must survive B's orphaned finally
      expect(spinner.hasAttribute('data-flux-active')).toBe(true);
      expect(sourceA.getAttribute('data-flux-loading')).toBe('1');

      resetFeedbackForTests();
      spinner.remove();
      sourceA.remove();
      sourceB.remove();
      meta.remove();
    });

    it('sets data-flux-success on 2xx and data-flux-error on 4xx/5xx', () => {
      resetFeedbackForTests();
      installFeedback();

      const source = makeEl('<button fx-post="/save">Save</button>');
      document.body.appendChild(source);

      source.dispatchEvent(
        new CustomEvent('htmx:after:request', {
          bubbles: true,
          detail: {
            ctx: {
              sourceElement: source,
              response: { status: 200 },
              successful: true,
            },
          },
        }),
      );

      expect(source.getAttribute('data-flux-success')).toBe('1');
      expect(source.hasAttribute('data-flux-error')).toBe(false);

      source.dispatchEvent(
        new CustomEvent('htmx:after:request', {
          bubbles: true,
          detail: {
            ctx: {
              sourceElement: source,
              response: { status: 500 },
              successful: false,
            },
          },
        }),
      );

      expect(source.getAttribute('data-flux-error')).toBe('1');
      expect(source.hasAttribute('data-flux-success')).toBe(false);
      resetFeedbackForTests();
    });
  });

  it('Listens to htmx:error events and marks data-flux-network-error', () => {
    resetFeedbackForTests();
    installFeedback();

    const btn = makeEl('<button fx-get="/fail">Fetch</button>');
    document.body.appendChild(btn);

    btn.dispatchEvent(
      new CustomEvent('htmx:error', {
        bubbles: true,
        detail: { elt: btn, error: 'Network Connection Failed' },
      }),
    );

    expect(btn.getAttribute('data-flux-error')).toBe('1');
    expect(btn.getAttribute('data-flux-network-error')).toBe('1');

    resetFeedbackForTests();
  });

  it('does not double-decrement inFlight counter when both after:request and finally:request fire', () => {
    resetFeedbackForTests();
    installFeedback();

    const source = makeEl('<button fx-get="/test">Fetch</button>');
    document.body.appendChild(source);

    const ctx = { sourceElement: source };

    source.dispatchEvent(
      new CustomEvent('htmx:before:request', { bubbles: true, detail: { ctx } }),
    );
    expect(source.getAttribute('data-flux-loading')).toBe('1');

    source.dispatchEvent(
      new CustomEvent('htmx:after:request', { bubbles: true, detail: { ctx, ctx_res: 200 } }),
    );
    source.dispatchEvent(
      new CustomEvent('htmx:finally:request', { bubbles: true, detail: { ctx } }),
    );

    expect(source.hasAttribute('data-flux-loading')).toBe(false);
    resetFeedbackForTests();
  });

  describe('offline tracking data-flux-offline', () => {
    it('installs offline tracking on feedback setup', () => {
      resetFeedbackForTests();
      installFeedback();
      expect(document.body.hasAttribute('data-flux-offline')).toBe(false);
      resetFeedbackForTests();
    });
  });

  it('Request State Machine: cleanly sets state attributes without state pollution', () => {
    const el = makeEl('<div>Item</div>');

    setLoadingState(el, true);
    expect(el.getAttribute('data-flux-loading')).toBe('1');
    expect(el.hasAttribute('data-flux-error')).toBe(false);

    setRequestState(el, 'http-error', 422);
    expect(el.getAttribute('data-flux-error')).toBe('1');
    expect(el.getAttribute('data-flux-http-error')).toBe('422');
    expect(el.getAttribute('data-flux-loading')).toBe('1'); // Loading state preserved for concurrent requests

    setLoadingState(el, false);
    expect(el.hasAttribute('data-flux-loading')).toBe(false);

    setRequestState(el, 'idle');
    expect(el.hasAttribute('data-flux-error')).toBe(false);
  });

  it('Concurrent loading state isolation: setOutcomeState does not remove data-flux-loading', () => {
    const el = makeEl('<div>Control</div>');

    setLoadingState(el, true);
    expect(el.getAttribute('data-flux-loading')).toBe('1');

    setRequestState(el, 'success');
    expect(el.getAttribute('data-flux-success')).toBe('1');
    expect(el.getAttribute('data-flux-loading')).toBe('1'); // Loading state preserved for concurrent requests!

    setLoadingState(el, false);
    expect(el.hasAttribute('data-flux-loading')).toBe(false);
  });
});

describe('form submit feedback and 422 field errors', () => {
  it('disables submit button during request and re-enables on finally:request', () => {
    const form = makeEl(`
      <form fx-submit="/api/users">
        <button type="submit">Submit</button>
      </form>
    `);
    document.body.appendChild(form);
    applySubmit(form, { url: '/api/users' });

    const btn = form.querySelector('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    form.dispatchEvent(new CustomEvent('htmx:before:request', { bubbles: true }));
    expect(btn.disabled).toBe(true);

    form.dispatchEvent(new CustomEvent('htmx:finally:request', { bubbles: true }));
    expect(btn.disabled).toBe(false);
  });

  it('maps 422 JSON errors to data-flux-field-error slots and focuses invalid input', () => {
    const form = makeEl(`
      <form fx-submit="/api/users" fx-focus-error>
        <input name="email" value="bad-email" />
        <span data-flux-field-error="email"></span>
        <button type="submit">Submit</button>
      </form>
    `);
    document.body.appendChild(form);
    applySubmit(form, { url: '/api/users' });

    const input = form.querySelector('input') as HTMLInputElement;
    input.focus = vi.fn();

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            response: {
              status: 422,
              text: JSON.stringify({ errors: { email: 'Invalid email address' } }),
            },
            successful: false,
          },
        },
      }),
    );

    const slot = form.querySelector('[data-flux-field-error="email"]');
    expect(slot?.textContent).toBe('Invalid email address');
    expect(input.focus).toHaveBeenCalled();
  });

  it('handles field names with brackets and dots like items[0].name', () => {
    const form = makeEl(`
      <form fx-submit="/items">
        <input name="items[0].name" value="bad" />
        <span data-flux-field-error="items[0].name"></span>
      </form>
    `);
    document.body.appendChild(form);
    applySubmit(form, { url: '/items' });

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            text: JSON.stringify({ errors: { 'items[0].name': 'Item name required' } }),
            response: { status: 422 },
            successful: false,
          },
        },
      }),
    );

    const slot = form.querySelector('[data-flux-field-error="items[0].name"]');
    expect(slot?.textContent).toBe('Item name required');
  });

  it('422 JSON field validation with bracket escaping (items[0].name)', () => {
    const form = makeEl(`
      <form fx-submit="/save">
        <input name="items[0].name" />
        <span data-flux-field-error="items[0].name"></span>
      </form>
    `) as HTMLFormElement;
    document.body.appendChild(form);
    applySubmit(form, { url: '/save' });

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            response: { status: 422 },
            text: JSON.stringify({ errors: { 'items[0].name': 'Name is required' } }),
            successful: false,
          },
        },
      }),
    );

    const errSlot = form.querySelector('[data-flux-field-error="items[0].name"]');
    expect(errSlot?.textContent).toBe('Name is required');
  });

  it('escapes complex field names like profile.email and items[0].name', () => {
    const form = makeEl(`
      <form fx-submit="/api/profile">
        <input name="profile.email" value="bad" />
        <span data-flux-field-error="profile.email"></span>
      </form>
    `);
    document.body.appendChild(form);
    applySubmit(form, { url: '/api/profile' });

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            text: JSON.stringify({ errors: { 'profile.email': 'Invalid profile email' } }),
            response: { status: 422 },
            successful: false,
          },
        },
      }),
    );

    const slot = form.querySelector('[data-flux-field-error="profile.email"]');
    expect(slot?.textContent).toBe('Invalid profile email');
  });

  it('Restores control pre-existing disabled state after form submit', () => {
    const form = makeEl(`
      <form fx-submit="/save">
        <button type="submit" id="submit-btn">Submit</button>
        <button type="submit" id="already-disabled" disabled>Disabled</button>
      </form>
    `);
    document.body.appendChild(form);
    applySubmit(form, { url: '/save' });

    const btnNormal = form.querySelector<HTMLButtonElement>('#submit-btn')!;
    const btnDisabled = form.querySelector<HTMLButtonElement>('#already-disabled')!;

    // Request start
    form.dispatchEvent(new CustomEvent('htmx:before:request', { bubbles: true }));
    expect(btnNormal.disabled).toBe(true);
    expect(btnDisabled.disabled).toBe(true);

    // Request finally
    form.dispatchEvent(new CustomEvent('htmx:finally:request', { bubbles: true }));
    expect(btnNormal.disabled).toBe(false);
    expect(btnDisabled.disabled).toBe(true); // Must remain disabled!
  });
});

describe('request event context', () => {
  it('HTMX Event Detail Adapter: standardizes request details across event formats', () => {
    const customEvt = new CustomEvent('htmx:after:request', {
      detail: {
        ctx: {
          sourceElement: document.body,
          response: { status: 200, text: 'OK' },
          successful: true,
        },
      },
    });

    const ctx = getRequestContext(customEvt);
    expect(ctx.source).toBe(document.body);
    expect(ctx.status).toBe(200);
    expect(ctx.text).toBe('OK');
    expect(ctx.successful).toBe(true);
  });
});

describe('csrf', () => {
  it('handles encoded tokens and ignores malformed segments without "="', () => {
    Object.defineProperty(document, 'cookie', {
      value: 'malformed_cookie_segment; csrftoken=abc%20123%25xyz',
      configurable: true,
    });
    expect(readCookie('csrftoken')).toBe('abc 123%xyz');
  });
});

describe('validation', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    cache.clear();
    document.body.innerHTML = '';
    resetFeedbackForTests();
    Flux.configure();
  });

  it('fx-validate: prevents default on invalid form submit', () => {
    const el = makeEl(`
      <form fx-submit="/post" fx-validate>
        <input name="email" type="email" required>
        <button type="submit">Submit</button>
      </form>
    `);
    document.body.appendChild(el);
    Flux.process(el);

    const form = el as HTMLFormElement;
    // JSDOM supports reportValidity
    const spy = vi.spyOn(form, 'reportValidity').mockReturnValue(false);

    let prevented = false;
    const confirmEvent = new CustomEvent('htmx:confirm', {
      bubbles: true,
      cancelable: true,
      detail: { elt: el },
    });
    confirmEvent.preventDefault = () => {
      prevented = true;
    };

    el.dispatchEvent(confirmEvent);

    expect(spy).toHaveBeenCalled();
    expect(prevented).toBe(true);
  });
});
