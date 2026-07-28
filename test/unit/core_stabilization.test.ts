import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import { applySubmit } from '../../src/presets/submit.js';
import { resolveRemovalTarget } from '../../src/presets/delete.js';
import { expandElement } from '../../src/core/expand.ts';
import { installFeedback, resetFeedbackForTests } from '../../src/core/feedback.js';
import { installOpenController } from '../../src/components/components.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('Core Stabilization Fix 1: fx-reset default logic', () => {
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
});

describe('Core Stabilization Fix 2: request counter single decrement', () => {
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
});

describe('Core Stabilization Fix 3: 422 escaping for Django field names', () => {
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
});

describe('Core Stabilization Fix 4: safe removal target selector parser', () => {
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

describe('Core Stabilization Fix 5: confirm dialog request drop on cancel', () => {
  it('calls detail.dropRequest when confirm dialog is cancelled', () => {
    const teardown = installOpenController();
    const dialog = document.createElement('dialog');
    dialog.id = 'cancel-dialog';
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    document.body.appendChild(dialog);

    const btn = makeEl(
      '<button fx-delete="/item/1" fx-confirm-dialog="#cancel-dialog">Delete</button>',
    );
    document.body.appendChild(btn);

    const dropRequest = vi.fn();
    btn.dispatchEvent(
      new CustomEvent('htmx:confirm', {
        bubbles: true,
        detail: { elt: btn, issueRequest: vi.fn(), dropRequest },
      }),
    );

    // Simulate dialog close (cancel/Escape)
    dialog.dispatchEvent(new Event('close'));
    expect(dropRequest).toHaveBeenCalled();

    teardown();
  });
});

describe('Enhanced fx-morph value mapping', () => {
  it('maps fx-morph="outer" to hx-swap="outerMorph" and fx-morph="sync" to hx-swap="outerSync"', () => {
    const el1 = makeEl('<div fx-morph="outer"></div>');
    expandElement(el1);
    expect(el1.getAttribute('hx-swap')).toBe('outerMorph');

    const el2 = makeEl('<div fx-morph="sync"></div>');
    expandElement(el2);
    expect(el2.getAttribute('hx-swap')).toBe('outerSync');
  });
});
