import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import { applySubmit } from '../../src/presets/submit.js';
import { expandElement } from '../../src/core/expand.ts';
import { installFeedback, resetFeedbackForTests } from '../../src/core/feedback.ts';
import { installOpenController } from '../../src/components/components.js';
import { inspectHtml } from '../../src/cli/commands.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('Form experience: fx-disable, fx-focus-error, and 422 JSON field error mapping', () => {
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
});

describe('fx-morph & fx-preserve expansion', () => {
  it('expands fx-morph into hx-swap="innerMorph"', () => {
    const el = makeEl('<form fx-submit="/save" fx-morph></form>');
    expandElement(el);
    expect(el.getAttribute('hx-swap')).toBe('innerMorph');
  });
});

describe('offline tracking data-flux-offline', () => {
  it('installs offline tracking on feedback setup', () => {
    resetFeedbackForTests();
    installFeedback();
    expect(document.body.hasAttribute('data-flux-offline')).toBe(false);
    resetFeedbackForTests();
  });
});

describe('custom confirmation dialog fx-confirm-dialog', () => {
  it('opens native dialog on htmx:confirm event and resumes on confirm click', () => {
    const teardown = installOpenController();
    const dialog = document.createElement('dialog');
    dialog.id = 'confirm-modal';
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();

    const confirmBtn = document.createElement('button');
    confirmBtn.setAttribute('data-flux-confirm', '1');
    dialog.appendChild(confirmBtn);
    document.body.appendChild(dialog);

    const btn = makeEl(
      '<button fx-delete="/item/1" fx-confirm-dialog="#confirm-modal">Delete</button>',
    );
    document.body.appendChild(btn);

    const issueRequest = vi.fn();
    btn.dispatchEvent(
      new CustomEvent('htmx:confirm', {
        bubbles: true,
        detail: { elt: btn, issueRequest },
      }),
    );

    expect(dialog.showModal).toHaveBeenCalled();

    confirmBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.close).toHaveBeenCalled();
    expect(issueRequest).toHaveBeenCalledWith(true);

    teardown();
  });
});

describe('CLI inspectHtml expansions', () => {
  it('inspects fx-submit, fx-autosave, fx-morph, and fx-on-422', () => {
    const html = `
      <form fx-submit="/users" fx-morph fx-on-422="#errors"></form>
      <input fx-autosave="/save" />
    `;
    const lines = inspectHtml(html);
    expect(lines.some((l) => l.includes('fx-submit="/users"'))).toBe(true);
    expect(lines.some((l) => l.includes('fx-morph → hx-swap="innerMorph"'))).toBe(true);
    expect(lines.some((l) => l.includes('fx-on-422="#errors" → hx-target-422="#errors"'))).toBe(
      true,
    );
  });
});
