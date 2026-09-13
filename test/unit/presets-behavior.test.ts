import './setup.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { expandPresets } from '../../src/core/lifecycle.js';
import { expandElement } from '../../src/core/expand.ts';
import { reconcileGeneratedAttributes } from '../../src/core/generated-attributes.ts';
import { resetFeedbackForTests } from '../../src/core/feedback.js';
import { applyPreset, disposePresetControllers } from '../../src/presets/index.js';
import { applySubmit } from '../../src/presets/submit.js';
import { applyDelete, resolveRemovalTarget } from '../../src/presets/delete.js';
import { applyAutosave } from '../../src/presets/autosave.js';
import { applyPrefetch } from '../../src/presets/prefetch.js';
import { applyPagination } from '../../src/presets/pagination.ts';
import { cache } from '../../src/cache/instance.js';
import { cacheKey } from '../../src/cache/cacheWire.js';

function makeEl(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as HTMLElement;
}

function makeRoot(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html.trim();
  return root;
}

const ctxFor = (el: Element) => (attr: string) => el.getAttribute(attr) ?? undefined;

describe('preset expansion (expandPresets)', () => {
  it('expands fx-get on a descendant', () => {
    const root = makeRoot('<div><button fx-get="/u">x</button></div>');
    expect(expandPresets(root)).toBeGreaterThanOrEqual(1);
    expect(root.querySelector('button')!.getAttribute('hx-get')).toBe('/u');
  });

  it('expands an element that is the root itself', () => {
    const root = document.createElement('button');
    root.setAttribute('fx-get', '/u');
    expandPresets(root);
    expect(root.getAttribute('hx-get')).toBe('/u');
  });

  it('expands fx-search before generic so generic does not clobber the preset', () => {
    const root = makeRoot('<input fx-search="/q" fx-target="#r" fx-delay="300ms">');
    expandPresets(root);
    const input = root.querySelector('input')!;
    // Preset produced hx-get + hx-trigger (native debounce uses flux:search-ready); generic fx-target becomes hx-target.
    expect(input.getAttribute('hx-get')).toBe('/q');
    expect(input.getAttribute('hx-trigger')).toBe('flux:search-ready');
    expect(input.getAttribute('hx-target')).toBe('#r');
    // fx-* source attributes are preserved.
    expect(input.getAttribute('fx-search')).toBe('/q');
  });

  it('is idempotent on repeated calls', () => {
    const root = makeRoot('<button fx-get="/u" fx-target="#u">x</button>');
    expandPresets(root);
    const second = expandPresets(root);
    expect(second).toBe(0);
    expect(root.querySelector('button')!.getAttribute('hx-get')).toBe('/u');
  });

  it('leaves raw hx-* authoritative when mixed with fx-*', () => {
    const root = makeRoot('<button fx-get="/flux" hx-get="/raw">x</button>');
    expandPresets(root);
    expect(root.querySelector('button')!.getAttribute('hx-get')).toBe('/raw');
  });
});

describe('preset conflict groups', () => {
  afterEach(() => {
    disposePresetControllers();
    document.body.innerHTML = '';
  });

  // Regression: fx-hide-escape + fx-hide-outside used to be flagged as conflicting and the
  // secondary (fx-hide-outside) was silently dropped — outside-click close never attached.
  it('lets fx-hide-escape and fx-hide-outside coexist on one element', () => {
    const panel = makeEl('<div id="p" fx-hide-escape fx-hide-outside></div>');
    document.body.append(panel);
    const ctx = ctxFor(panel);

    expect(applyPreset(panel, 'fx-hide-escape', 'this', ctx)).toBe(true);
    expect(applyPreset(panel, 'fx-hide-outside', 'this', ctx)).toBe(true);
  });

  it('keeps fx-show / fx-hide mutually exclusive (visibility group)', () => {
    const trigger = makeEl('<button fx-show="#t" fx-hide="#t"></button>');
    const target = makeEl('<div id="t"></div>');
    document.body.append(trigger, target);
    const ctx = ctxFor(trigger);

    expect(applyPreset(trigger, 'fx-show', '#t', ctx)).toBe(true);
    // fx-hide is the secondary visibility member -> skipped.
    expect(applyPreset(trigger, 'fx-hide', '#t', ctx)).toBe(false);
  });

  it('keeps request presets (fx-load / fx-poll) mutually exclusive', () => {
    const el = makeEl('<div fx-load="/a" fx-poll="/b" fx-interval="2s"></div>');
    document.body.append(el);
    const ctx = ctxFor(el);

    expect(applyPreset(el, 'fx-load', '/a', ctx)).toBe(true);
    expect(applyPreset(el, 'fx-poll', '/b', ctx)).toBe(false);
  });

  it('is idempotent: re-applying the same preset with no change is a no-op', () => {
    const panel = makeEl('<div fx-hide-escape></div>');
    document.body.append(panel);
    const ctx = ctxFor(panel);

    expect(applyPreset(panel, 'fx-hide-escape', 'this', ctx)).toBe(true);
    expect(applyPreset(panel, 'fx-hide-escape', 'this', ctx)).toBe(false);
  });

  it('reconnects when the preset value changes', () => {
    const panel = makeEl('<div fx-hide-escape></div>');
    document.body.append(panel);
    const ctx = ctxFor(panel);

    expect(applyPreset(panel, 'fx-hide-escape', 'this', ctx)).toBe(true);
    expect(applyPreset(panel, 'fx-hide-escape', '#other', ctx)).toBe(true);
  });

  it('disconnects every coexisting controller on dispose', () => {
    const panel = makeEl('<div fx-hide-escape fx-hide-outside></div>');
    document.body.append(panel);
    const ctx = ctxFor(panel);
    applyPreset(panel, 'fx-hide-escape', 'this', ctx);
    applyPreset(panel, 'fx-hide-outside', 'this', ctx);

    const removeSpy = vi.spyOn(document, 'removeEventListener');
    disposePresetControllers();
    const removed = removeSpy.mock.calls.map((c) => c[0]);
    expect(removed).toEqual(expect.arrayContaining(['keydown', 'click']));
    removeSpy.mockRestore();
  });
});

describe('fx-submit', () => {
  it('expands to hx-post by default', () => {
    const el = makeEl('<form fx-submit="/api/users"></form>');
    expect(applySubmit(el, { url: '/api/users' })).toBe(true);
    expect(el.getAttribute('hx-post')).toBe('/api/users');
  });

  it('respects fx-method option', () => {
    const el = makeEl('<form fx-submit="/api/users" fx-method="put"></form>');
    expect(applySubmit(el, { url: '/api/users' })).toBe(true);
    expect(el.getAttribute('hx-put')).toBe('/api/users');
  });

  it('passes all feedback and reset options from dispatcher to applySubmit', () => {
    const el = makeEl(
      '<form fx-submit="/users" fx-success="Created" fx-error="Failed" fx-invalidate="list" fx-reset></form>',
    );
    const attrs: Record<string, string> = {
      'fx-success': 'Created',
      'fx-error': 'Failed',
      'fx-invalidate': 'list',
    };
    applyPreset(el, 'fx-submit', '/users', (attr) => attrs[attr]);

    expect(el.getAttribute('fx-success')).toBe('Created');
    expect(el.getAttribute('fx-error')).toBe('Failed');
    expect(el.getAttribute('fx-invalidate')).toBe('list');
  });

  it('warns and falls back to post when invalid method is passed', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = makeEl('<form fx-submit="/save" fx-method="banana"></form>');
    applySubmit(el, { url: '/save' });
    expect(el.getAttribute('hx-post')).toBe('/save');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('fx-delete', () => {
  it('expands to hx-delete and sets confirmation/invalidation attributes', () => {
    const el = makeEl(
      '<button fx-delete="/users/42" fx-confirm="Delete?" fx-success="Deleted" fx-invalidate="users:*"></button>',
    );
    expect(
      applyDelete(el, {
        url: '/users/42',
        confirm: 'Delete?',
        success: 'Deleted',
        invalidate: 'users:*',
      }),
    ).toBe(true);
    expect(el.getAttribute('hx-delete')).toBe('/users/42');
    expect(el.getAttribute('hx-confirm')).toBe('Delete?');
    expect(el.getAttribute('fx-success')).toBe('Deleted');
    expect(el.getAttribute('fx-invalidate')).toBe('users:*');
  });

  it('does not remove element if request fails, and retains listener for successful retry', () => {
    const el = makeEl('<button fx-delete="/users/42" fx-remove="this"></button>');
    document.body.appendChild(el);
    applyDelete(el, { url: '/users/42', remove: 'this' });

    // 1st request fails with HTTP 500
    el.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { ctx: { successful: false, response: { status: 500 } } },
      }),
    );
    expect(document.body.contains(el)).toBe(true);

    // 2nd request retries and succeeds with HTTP 200
    el.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { ctx: { successful: true, response: { status: 200 } } },
      }),
    );
    expect(document.body.contains(el)).toBe(false);
  });
});

describe('fx-delete removal target parsing', () => {
  it('parses closest tr and handles invalid selector expressions without throwing', () => {
    const table = makeEl(`
      <table>
        <tr id="row1">
          <td><button fx-delete="/item/1" fx-remove="closest tr">Delete</button></td>
        </tr>
      </table>
    `);
    document.body.appendChild(table);
    const btn = table.querySelector('button')!;

    const trTarget = resolveRemovalTarget(btn, 'closest tr');
    expect(trTarget?.id).toBe('row1');

    // Invalid selector syntax should return null safely without crashing
    const invalidTarget = resolveRemovalTarget(btn, 'invalid[[[selector');
    expect(invalidTarget).toBe(null);
  });
});

describe('fx-autosave', () => {
  it('expands to hx-post with debounced change and input triggers', () => {
    const el = makeEl('<form fx-autosave="/api/save"></form>');
    expect(applyAutosave(el, { url: '/api/save' })).toBe(true);
    expect(el.getAttribute('hx-post')).toBe('/api/save');
    expect(el.getAttribute('hx-trigger')).toContain('input changed delay:500ms');
  });

  it('adds input changed delay, change changed, and hx-sync replace', () => {
    const el = makeEl('<form fx-autosave="/api/save" fx-delay="300ms"></form>');
    applyAutosave(el, { url: '/api/save', delay: '300ms' });
    expect(el.getAttribute('hx-trigger')).toContain('input changed delay:300ms');
    expect(el.getAttribute('hx-sync')).toBe('this:replace');
  });
});

describe('fx-morph / fx-preserve', () => {
  it('expands fx-morph into hx-swap="innerMorph"', () => {
    const el = makeEl('<form fx-submit="/save" fx-morph></form>');
    expandElement(el);
    expect(el.getAttribute('hx-swap')).toBe('innerMorph');
  });

  it('maps fx-morph="outer" to hx-swap="outerMorph" and fx-morph="sync" to hx-swap="outerSync"', () => {
    const el1 = makeEl('<div fx-morph="outer"></div>');
    expandElement(el1);
    expect(el1.getAttribute('hx-swap')).toBe('outerMorph');

    const el2 = makeEl('<div fx-morph="sync"></div>');
    expandElement(el2);
    expect(el2.getAttribute('hx-swap')).toBe('outerSync');
  });

  it('falls back to innerMorph on invalid fx-morph value', () => {
    const el = makeEl('<div fx-morph="banana"></div>');
    expandElement(el);
    expect(el.getAttribute('hx-swap')).toBe('innerMorph');
  });
});

describe('fx-reset', () => {
  it('does NOT reset form on successful submit unless fx-reset is present', () => {
    const form = makeEl(`
      <form fx-submit="/users">
        <input name="username" value="john" />
      </form>
    `) as HTMLFormElement;
    document.body.appendChild(form);
    form.reset = vi.fn();
    applySubmit(form, { url: '/users' });

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            response: { status: 200 },
            successful: true,
          },
        },
      }),
    );

    expect(form.reset).not.toHaveBeenCalled();
  });

  it('resets form when fx-reset attribute is present', () => {
    const form = makeEl(`
      <form fx-submit="/users" fx-reset>
        <input name="username" value="john" />
      </form>
    `) as HTMLFormElement;
    document.body.appendChild(form);
    form.reset = vi.fn();
    applySubmit(form, { url: '/users' });

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: form,
            response: { status: 200 },
            successful: true,
          },
        },
      }),
    );

    expect(form.reset).toHaveBeenCalled();
  });

  it('Form reset rules (opt-in vs default)', () => {
    const formOptIn = makeEl(
      '<form fx-submit="/save" fx-reset><input name="v" value="1" /></form>',
    ) as HTMLFormElement;
    formOptIn.reset = vi.fn();
    document.body.appendChild(formOptIn);
    applySubmit(formOptIn, { url: '/save' });

    formOptIn.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { ctx: { sourceElement: formOptIn, response: { status: 200 }, successful: true } },
      }),
    );
    expect(formOptIn.reset).toHaveBeenCalled();

    const formDefault = makeEl(
      '<form fx-submit="/save"><input name="v" value="1" /></form>',
    ) as HTMLFormElement;
    formDefault.reset = vi.fn();
    document.body.appendChild(formDefault);
    applySubmit(formDefault, { url: '/save' });

    formDefault.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: { sourceElement: formDefault, response: { status: 200 }, successful: true },
        },
      }),
    );
    expect(formDefault.reset).not.toHaveBeenCalled();
  });
});

describe('fx-scope', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    document.body.innerHTML = '';
    Flux.configure();
  });

  it('inherits defaults from nearest fx-scope', () => {
    const scope = document.createElement('section');
    scope.setAttribute('fx-scope', '');
    scope.setAttribute('fx-default-target', '#users-table');
    scope.setAttribute('fx-default-indicator', '#loading');
    scope.setAttribute('fx-default-error', 'Failed');
    document.body.appendChild(scope);

    const btn = document.createElement('button');
    btn.setAttribute('fx-get', '/users');
    scope.appendChild(btn);

    Flux.process(btn);

    // Htmx option keys write the raw hx-* attribute; preset keys write fx-*.
    expect(btn.getAttribute('hx-target')).toBe('#users-table');
    expect(btn.getAttribute('hx-indicator')).toBe('#loading');
    expect(btn.getAttribute('fx-error')).toBe('Failed');
  });

  it('does not overwrite explicit element attributes', () => {
    const scope = document.createElement('section');
    scope.setAttribute('fx-scope', '');
    scope.setAttribute('fx-default-target', '#users-table');
    document.body.appendChild(scope);

    const btn = document.createElement('button');
    btn.setAttribute('fx-get', '/users');
    btn.setAttribute('hx-target', '#explicit-target');
    scope.appendChild(btn);

    Flux.process(btn);

    expect(btn.getAttribute('hx-target')).toBe('#explicit-target');
  });

  it('raw explicit hx-target is never overwritten by scope defaults', () => {
    const scope = document.createElement('section');
    scope.setAttribute('fx-scope', '');
    scope.setAttribute('fx-default-target', '#scope-target');
    document.body.appendChild(scope);

    const btn = document.createElement('button');
    btn.setAttribute('fx-get', '/users');
    btn.setAttribute('hx-target', '#explicit-target');
    scope.appendChild(btn);

    Flux.process(btn);

    expect(btn.getAttribute('hx-target')).toBe('#explicit-target');
  });
});

describe('fx-prefetch', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    cache.clear();
    document.body.innerHTML = '';
    resetFeedbackForTests();
    Flux.configure();
  });

  it('fx-prefetch: fetches URL and populates cache on mouseenter', async () => {
    const el = makeEl('<a fx-prefetch fx-get="/test-prefetch">Hover me</a>');
    document.body.appendChild(el);
    Flux.process(document.body);

    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('prefetched content'),
      headers: { get: () => null },
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    // Trigger mouseenter
    el.dispatchEvent(new MouseEvent('mouseenter'));

    // Wait for fetch to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockFetch).toHaveBeenCalledWith(
      '/test-prefetch',
      expect.objectContaining({
        headers: expect.objectContaining({
          'HX-Request': 'true',
          'X-Flux-Prefetch': 'true',
        }),
      }),
    );

    const key = cacheKey(el, { method: 'GET', action: '/test-prefetch' });
    const cached = cache.get(key);
    expect(cached).toBe('prefetched content');
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

describe('preset reprocessing and attribute cleanup', () => {
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
    expect(form.getAttribute('hx-target')).toBe('#result');
    expect(form.getAttribute('fx-disable')).toBe('true');
  });

  it('removes stale generated request attributes when a preset becomes empty', () => {
    Flux.configure();
    const form = makeEl('<form fx-submit="/ok"></form>');
    document.body.appendChild(form);
    Flux.process(form);

    form.setAttribute('fx-submit', '');
    Flux.process(form);

    expect(form.hasAttribute('hx-post')).toBe(false);
    expect(form.hasAttribute('data-flux-preset')).toBe(false);
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
});

describe('fx-pagination', () => {
  it('Pagination Preset: applies fx-page and cleans up stale hx-swap on option removal', () => {
    const el = makeEl('<button fx-page="/items?page=2" fx-target="#items" fx-append>More</button>');
    const ok = applyPagination(el, {
      url: '/items?page=2',
      target: '#items',
      append: true,
    });
    expect(ok).toBe(true);
    expect(el.getAttribute('hx-get')).toBe('/items?page=2');
    expect(el.getAttribute('hx-swap')).toBe('beforeend');

    // Remove append option and re-apply
    const ok2 = applyPagination(el, {
      url: '/items?page=2',
      target: '#items',
      append: false,
    });
    expect(ok2).toBe(true);
    expect(el.getAttribute('hx-swap')).toBeNull();
  });
});

describe('fx-history', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    cache.clear();
    document.body.innerHTML = '';
    resetFeedbackForTests();
    Flux.configure();
  });

  it('fx-history: expands to hx-push-url="true"', () => {
    const el = makeEl('<a fx-history>Link</a>');
    Flux.process(el);
    expect(el.getAttribute('hx-push-url')).toBe('true');
  });
});

describe('fx-disable expansion', () => {
  it('fx-disable is not expanded into hx-disable as a generic option', () => {
    const el = makeEl('<form fx-submit="/save" fx-disable="button[type=submit]"></form>');
    expandElement(el);
    expect(el.hasAttribute('hx-disable')).toBe(false);
  });
});

describe('preset attribute cleanup on removal', () => {
  it('Removing optional preset attribute cleans up generated attribute', () => {
    const el = makeEl('<div fx-load="/panel" fx-target="#res"></div>');
    Flux.process(el);
    expect(el.getAttribute('hx-target')).toBe('#res');

    el.removeAttribute('fx-target');
    Flux.process(el);
    expect(el.hasAttribute('hx-target')).toBe(false);
  });

  it('Removing preset attribute completely tears down generated attributes and signature', () => {
    const el = makeEl('<form fx-submit="/save"></form>');
    Flux.process(el);
    expect(el.getAttribute('data-flux-preset')).toBe('submit');
    expect(el.hasAttribute('hx-post')).toBe(true);

    el.removeAttribute('fx-submit');
    reconcileGeneratedAttributes(el);
    expect(el.hasAttribute('data-flux-preset')).toBe(false);
    expect(el.hasAttribute('hx-post')).toBe(false);
  });
});
