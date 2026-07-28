import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import { installOpenController } from '../../src/components/components.js';
import { isSuccessfulRequest, queryAllSafely } from '../../src/core/utils.js';
import { applySubmit } from '../../src/presets/submit.js';
import { expandElement } from '../../src/core/expand.ts';
import { installCacheIntegration } from '../../src/cache/cacheWire.js';
import { FragmentCache } from '../../src/cache/cache.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('Release Candidate Item 1: Confirm dialog cancel-first target matching', () => {
  it('treats <button type="submit" formmethod="dialog"> as cancel target and drops request', () => {
    const teardown = installOpenController();
    const dialog = document.createElement('dialog');
    dialog.id = 'cancel-test';
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'submit';
    cancelBtn.setAttribute('formmethod', 'dialog');
    dialog.appendChild(cancelBtn);
    document.body.appendChild(dialog);

    const triggerBtn = makeEl(
      '<button fx-delete="/item/1" fx-confirm-dialog="#cancel-test">Delete</button>',
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
    expect(issueRequest).not.toHaveBeenCalled();

    teardown();
  });
});

describe('Release Candidate Item 3: Shared strict isSuccessfulRequest helper', () => {
  it('returns true for 2xx status and false for missing/error status', () => {
    expect(isSuccessfulRequest({ ctx: { successful: true } })).toBe(true);
    expect(isSuccessfulRequest({ ctx: { response: { status: 200 } } })).toBe(true);
    expect(isSuccessfulRequest({ ctx: { response: { status: 422 } } })).toBe(false);
    expect(isSuccessfulRequest(null)).toBe(false);
    expect(isSuccessfulRequest({})).toBe(false);
  });
});

describe('Release Candidate Item 4: Safe queryAllSafely for fx-disable', () => {
  it('handles invalid fx-disable selector without throwing an unhandled exception', () => {
    const form = makeEl(
      '<form fx-submit="/save" fx-disable="["><button type="submit">Save</button></form>',
    );
    document.body.appendChild(form);
    applySubmit(form, { url: '/save' });

    expect(() => {
      form.dispatchEvent(new CustomEvent('htmx:before:request', { bubbles: true }));
    }).not.toThrow();
  });

  it('safely queries elements via queryAllSafely', () => {
    const container = makeEl('<div><span class="a"></span><span class="a"></span></div>');
    const els = queryAllSafely(container, '.a');
    expect(els.length).toBe(2);

    const invalidEls = queryAllSafely(container, '[[[invalid');
    expect(invalidEls).toEqual([]);
  });
});

describe('Release Candidate Item 6: Form GET cache key serialization', () => {
  it('serializes entire form inputs into GET query parameters for cache key', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const form = makeEl(`
      <form fx-get="/search" fx-cache="60s">
        <input name="q" value="apple" />
        <input name="page" value="1" />
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
          text: '<div>Form Apple Results</div>',
        },
      }),
    );

    expect(cache.get('GET:/search?page=1&q=apple')).toBe('<div>Form Apple Results</div>');
  });
});

describe('Release Candidate Item 7: fx-morph invalid value warning', () => {
  it('falls back to innerMorph on invalid fx-morph value', () => {
    const el = makeEl('<div fx-morph="banana"></div>');
    expandElement(el);
    expect(el.getAttribute('hx-swap')).toBe('innerMorph');
  });
});
