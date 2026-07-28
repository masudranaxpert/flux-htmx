import './setup.js';
import { describe, expect, it } from 'vitest';
import { verifyHtmxVersion } from '../../src/core/startup.js';
import { installCacheIntegration } from '../../src/cache/cacheWire.js';
import { FragmentCache } from '../../src/cache/cache.js';
import { installFeedback, resetFeedbackForTests } from '../../src/core/feedback.js';
import { applySubmit } from '../../src/presets/submit.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('0.1.0 Alpha Release Requirement 1: HTMX 4 version compatibility guard', () => {
  it('throws an error if HTMX 2.x or non-4 is passed', () => {
    expect(() => verifyHtmxVersion({ version: '2.0.0' })).toThrow(
      '[flux] HTMX 4 is required; found 2.0.0',
    );
    expect(() => verifyHtmxVersion(null)).toThrow('[flux] HTMX was not found');
    expect(() => verifyHtmxVersion({ version: '4.0.0-beta6' })).not.toThrow();
  });
});

describe('0.1.0 Alpha Release Requirement 3: Canonical & sensitive-safe cache key', () => {
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

    // Key must be sorted alphabetically (a=1&b=2) and omit password/csrf token
    expect(cache.get('GET:/search?a=1&b=2')).toBe('<div>Sorted Search Results</div>');
  });
});

describe('0.1.0 Alpha Release Polish: Clear old error attributes on new request start', () => {
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
});

describe('0.1.0 Alpha Release Polish: Complex Django field selector escaping', () => {
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
});
