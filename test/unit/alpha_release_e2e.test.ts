import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { installOpenController } from '../../src/components/components.js';
import { applySubmit } from '../../src/presets/submit.js';
import { wireStatusTargeting } from '../../src/core/status.js';
import { installFeedback, resetFeedbackForTests } from '../../src/core/feedback.js';
import { installCacheIntegration } from '../../src/cache/cacheWire.js';
import { FragmentCache } from '../../src/cache/cache.js';
import pkg from '../../package.json';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('0.1.0-Alpha Release E2E Acceptance Test Suite', () => {
  it('Scenario 1: GET form cache differentiation with sorted parameters', () => {
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

  it('Scenario 2: fx-cache-vary explicit field whitelist isolation', () => {
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

  it('Scenario 3: Form reset rules (opt-in vs default)', () => {
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

  it('Scenario 4: Native HTMX 4 status target attribute compilation (hx-status:422)', () => {
    const el = makeEl('<button fx-post="/save" fx-on-422="#errors">Save</button>');
    document.body.appendChild(el);
    wireStatusTargeting(el);
    expect(el.getAttribute('hx-status:422')).toBe(JSON.stringify({ target: '#errors' }));
  });

  it('Scenario 5: Confirm dialog cancellation drops request', () => {
    const teardown = installOpenController();
    const dialog = document.createElement('dialog');
    dialog.id = 'cancel-dlg';
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'submit';
    cancelBtn.setAttribute('formmethod', 'dialog');
    dialog.appendChild(cancelBtn);
    document.body.appendChild(dialog);

    const triggerBtn = makeEl(
      '<button fx-delete="/item/1" fx-confirm-dialog="#cancel-dlg">Delete</button>',
    );
    document.body.appendChild(triggerBtn);

    const dropRequest = vi.fn();
    const issueRequest = vi.fn();

    triggerBtn.dispatchEvent(
      new CustomEvent('htmx:confirm', {
        bubbles: true,
        detail: { elt: triggerBtn, issueRequest, dropRequest },
      }),
    );

    cancelBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dropRequest).toHaveBeenCalled();
    teardown();
  });

  it('Scenario 6: Offline and network error state attribute toggles', () => {
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

  it('Scenario 7: 422 JSON field validation with bracket escaping (items[0].name)', () => {
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

  it('Scenario 8: Modular ESM API exports parity', () => {
    expect(typeof Flux.start).toBe('function');
    expect(typeof Flux.reconfigure).toBe('function');
    expect(typeof Flux.isStarted).toBe('function');
    expect(typeof Flux.config).toBe('function');
    expect(Flux.FLUX_VERSION).toBe(pkg.version);
  });
});
