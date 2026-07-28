import './setup.js';
import { describe, expect, it } from 'vitest';
import * as Flux from '../../src/flux.js';
import { installCacheIntegration } from '../../src/cache/cacheWire.js';
import { FragmentCache } from '../../src/cache/cache.js';
import { wireStatusTargeting } from '../../src/core/status.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('0.1.0-Beta Final Polish 1: DOM Reprocessing on reconfigure()', () => {
  it('automatically reprocesses document body after reconfiguring runtime', () => {
    Flux.dispose();
    Flux.configure({ requests: { timeoutMs: 1000 } });

    const btn = makeEl('<button fx-post="/delete" fx-confirm="Are you sure?">Delete</button>');
    document.body.appendChild(btn);

    Flux.reconfigure({ requests: { timeoutMs: 3000 } });

    // Expansion attributes should be re-applied to existing DOM elements
    expect(btn.getAttribute('hx-confirm')).toBe('Are you sure?');
    Flux.dispose();
  });
});

describe('0.1.0-Beta Final Polish 2: Canonical URL Query + Form Parameter Merging', () => {
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

    // Key must merge category=books and q=python, and strictly omit token and password
    expect(cache.get('GET:/search?category=books&q=python')).toBe(
      '<div>Merged Query Results</div>',
    );
    expect(
      cache.get('GET:/search?category=books&password=secret&q=python&token=secret123'),
    ).toBeNull();
  });
});

describe('0.1.0-Beta Final Polish 3: Skip Invalid Status Selector Attribute Assignment', () => {
  it('skips setting hx-status:<code> attribute when CSS selector syntax is invalid', () => {
    const el = makeEl('<button fx-on-422="[">Save</button>');
    document.body.appendChild(el);
    wireStatusTargeting(el);
    expect(el.hasAttribute('hx-status:422')).toBe(false);
  });
});
