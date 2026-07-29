import './setup.js';
import { describe, expect, it } from 'vitest';
import * as Flux from '../../src/flux.js';
import { installCacheIntegration } from '../../src/cache/cacheWire.js';
import { FragmentCache } from '../../src/cache/cache.js';
import { installFeedback, resetFeedbackForTests } from '../../src/core/feedback.js';
import { wireStatusTargeting } from '../../src/core/status.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('0.1.0-Beta Release Upgrade 1: Sensitive field denial even with fx-cache-vary', () => {
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

    // Key must only include 'q=apple' and strictly exclude password and token
    expect(cache.get('GET:/login?q=apple')).toBe('<div>Login Response</div>');
    expect(cache.get('GET:/login?password=secret&q=apple')).toBeNull();
  });
});

describe('0.1.0-Beta Release Upgrade 2: Safe findNamedInput helper', () => {
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

    // Password input must be safely identified and excluded
    const stored = cache.get('GET:/items?items%5B0%5D.name=apple');
    expect(stored).toBe('<div>Item Response</div>');
  });
});

describe('0.1.0-Beta Release Upgrade 3: reconfigure() restart semantics', () => {
  it('reconfigures runtime by re-installing hooks with new configuration while preserving cache', () => {
    Flux.dispose();
    Flux.configure({ requests: { timeoutMs: 1000 } });
    expect(Flux.isStarted()).toBe(true);

    Flux.cache.set('GET:/test', 'cached value');

    const newConfig = Flux.reconfigure({ requests: { timeoutMs: 5000 } });
    expect(newConfig.requests.timeoutMs).toBe(5000);

    // Fragment cache must be preserved across reconfigure
    expect(Flux.cache.get('GET:/test')).toBe('cached value');

    Flux.dispose();
  });
});

describe('0.1.0-Beta Release Upgrade 4: Error attribute reset & status selector validation', () => {
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

  it('warns on invalid CSS selector in fx-on-<code> without crashing', () => {
    const el = makeEl('<button fx-on-422="[">Save</button>');
    document.body.appendChild(el);
    expect(() => wireStatusTargeting(el)).not.toThrow();
    expect(el.hasAttribute('hx-status:422')).toBe(false);
  });
});
