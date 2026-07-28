import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { installCacheIntegration } from '../../src/cache/cacheWire.js';
import { FragmentCache } from '../../src/cache/cache.js';
import { installOpenController } from '../../src/components/components.js';
import { wireStatusTargeting, disposeStatusTargeting } from '../../src/core/status.js';
import { duplicatePolicy } from '../../src/core/startup.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('v0.1.0-Beta P0/P1 Final Resolution Test Suite', () => {
  it('P0 Item 5: Converts /users* invalidation pattern to GET:/users* to match stored keys', () => {
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

  it('P0 Item 6: Skips caching GET requests if request Authorization header is present', () => {
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

  it('P1 Item 8: Maps fx-cache="true" to default TTL 60s', () => {
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

  it('P1 Item 9: Handles array parameters and unchecked standalone checkboxes in cache keys', () => {
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

  it('P1 Item 10: Drops previous pending request when a new confirmation replaces it', () => {
    const teardown = installOpenController();

    const dialog = document.createElement('dialog');
    dialog.id = 'replace-dlg';
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    document.body.appendChild(dialog);

    const btn1 = makeEl(
      '<button fx-delete="/1" fx-confirm-dialog="#replace-dlg">Delete 1</button>',
    );
    const btn2 = makeEl(
      '<button fx-delete="/2" fx-confirm-dialog="#replace-dlg">Delete 2</button>',
    );
    document.body.appendChild(btn1);
    document.body.appendChild(btn2);

    const drop1 = vi.fn();
    const issue2 = vi.fn();

    btn1.dispatchEvent(
      new CustomEvent('htmx:confirm', {
        bubbles: true,
        detail: { elt: btn1, issueRequest: vi.fn(), dropRequest: drop1 },
      }),
    );

    // Replacing with btn2 must invoke drop1()
    btn2.dispatchEvent(
      new CustomEvent('htmx:confirm', {
        bubbles: true,
        detail: { elt: btn2, issueRequest: issue2 },
      }),
    );
    expect(drop1).toHaveBeenCalled();

    teardown();
  });

  it('Hardening 1: Preserves user-written hx-target-422 attribute during disposeStatusTargeting()', () => {
    const form = makeEl('<form fx-on-422="#errors" hx-target-422="#custom-errors"></form>');
    document.body.appendChild(form);
    wireStatusTargeting(form);

    disposeStatusTargeting();

    // User-written hx-target-422 attribute must be preserved!
    expect(form.getAttribute('hx-target-422')).toBe('#custom-errors');
  });

  it('Hardening 2: Validates duplicatePolicy parameter strictly', () => {
    expect(() => duplicatePolicy('flux', {}, 'invalid' as any)).toThrow(
      '[flux] Invalid duplicatePolicy "invalid"',
    );
  });
});
