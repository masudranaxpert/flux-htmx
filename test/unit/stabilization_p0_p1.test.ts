import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { installFeedback, resetFeedbackForTests } from '../../src/core/feedback.js';
import { installCacheIntegration } from '../../src/cache/cacheWire.js';
import { FragmentCache } from '../../src/cache/cache.js';
import { wireStatusTargeting } from '../../src/core/status.js';
import { applySubmit } from '../../src/presets/submit.js';
import { installOpenController } from '../../src/components/components.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('P0 & P1 Release Stabilization Test Suite', () => {
  it('P0 Item 2: Compiles canonical hx-status:422 attribute for HTMX 4 compatibility', () => {
    const btn = makeEl('<button fx-post="/save" fx-on-422="#errors">Save</button>');
    document.body.appendChild(btn);
    wireStatusTargeting(btn);

    expect(btn.getAttribute('hx-status:422')).toBe(JSON.stringify({ target: '#errors' }));
  });

  it('P0 Item 3: Cleans up data-flux-preset markers on dispose() allowing seamless re-connection', () => {
    Flux.dispose();
    Flux.configure();

    const form = makeEl(
      '<form fx-submit="/save" fx-reset><button type="submit">Submit</button></form>',
    ) as HTMLFormElement;
    form.reset = vi.fn();
    document.body.appendChild(form);

    Flux.process(document.body);
    expect(form.getAttribute('data-flux-preset')).toBe('submit');

    // Dispose must clear the marker
    Flux.dispose();
    expect(form.hasAttribute('data-flux-preset')).toBe(false);

    // Re-starting must re-attach the controller
    Flux.start();
    expect(form.getAttribute('data-flux-preset')).toBe('submit');

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { ctx: { sourceElement: form, response: { status: 200 }, successful: true } },
      }),
    );
    expect(form.reset).toHaveBeenCalled();

    Flux.dispose();
  });

  it('P0 Item 5: Listens to htmx:error events and marks data-flux-network-error', () => {
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

  it('P1 Item 6: Honors hx-swap over fx-swap on cache hit', () => {
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

  it('P1 Item 7: Deduplicates canonical URL query parameters and form parameters', () => {
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

  it('P1 Item 8: Restores control pre-existing disabled state after form submit', () => {
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

  it('P1 Item 9: Does not cache responses with Authorization header or non-HTML Content-Type', () => {
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

  it('P2 Item 11: Cancels pending confirmation controller on new confirmation opening on same dialog', () => {
    const teardown = installOpenController();

    const dialog = document.createElement('dialog');
    dialog.id = 'confirm-dlg';
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'confirm';
    dialog.appendChild(confirmBtn);
    document.body.appendChild(dialog);

    const btn1 = makeEl(
      '<button fx-delete="/1" fx-confirm-dialog="#confirm-dlg">Delete 1</button>',
    );
    const btn2 = makeEl(
      '<button fx-delete="/2" fx-confirm-dialog="#confirm-dlg">Delete 2</button>',
    );
    document.body.appendChild(btn1);
    document.body.appendChild(btn2);

    const issue1 = vi.fn();
    const drop1 = vi.fn();
    const issue2 = vi.fn();

    btn1.dispatchEvent(
      new CustomEvent('htmx:confirm', {
        bubbles: true,
        detail: { elt: btn1, issueRequest: issue1, dropRequest: drop1 },
      }),
    );
    btn2.dispatchEvent(
      new CustomEvent('htmx:confirm', {
        bubbles: true,
        detail: { elt: btn2, issueRequest: issue2 },
      }),
    );

    // Click confirm -> only request 2 should issue
    confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(issue2).toHaveBeenCalled();
    expect(issue1).not.toHaveBeenCalled();

    teardown();
  });
});
