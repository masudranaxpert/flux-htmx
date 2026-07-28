import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import { applyDelete } from '../../src/presets/delete.js';
import { applyAutosave } from '../../src/presets/autosave.js';
import { applySubmit } from '../../src/presets/submit.js';
import { applyPreset } from '../../src/presets/index.js';
import { safeQuerySelector, installOpenController } from '../../src/components/components.js';
import { installCacheIntegration } from '../../src/cache/cacheWire.js';
import { FragmentCache } from '../../src/cache/cache.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('fx-delete retry bug fix', () => {
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

describe('fx-autosave trigger & sync enhancements', () => {
  it('adds input changed delay, change changed, and hx-sync replace', () => {
    const el = makeEl('<form fx-autosave="/api/save" fx-delay="300ms"></form>');
    applyAutosave(el, { url: '/api/save', delay: '300ms' });
    expect(el.getAttribute('hx-trigger')).toContain('input changed delay:300ms');
    expect(el.getAttribute('hx-sync')).toBe('this:replace');
  });
});

describe('fx-submit dispatcher & reset attributes', () => {
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
});

describe('method validation in submit and autosave', () => {
  it('warns and falls back to post when invalid method is passed', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = makeEl('<form fx-submit="/save" fx-method="banana"></form>');
    applySubmit(el, { url: '/save' });
    expect(el.getAttribute('hx-post')).toBe('/save');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('components safeQuerySelector and fx-close controller', () => {
  it('guards against invalid CSS selectors without throwing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(safeQuerySelector('[')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('closes dialog on fx-close click', () => {
    const teardown = installOpenController();
    const dialog = document.createElement('dialog');
    dialog.close = vi.fn();
    document.body.appendChild(dialog);

    const closeBtn = makeEl('<button fx-close></button>');
    dialog.appendChild(closeBtn);

    closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.close).toHaveBeenCalled();

    teardown();
  });
});

describe('query-aware cache keys and case-insensitive headers', () => {
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
