import './setup.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { registerAction, installServerActions } from '../../src/core/actions.js';
import { cache } from '../../src/cache/instance.js';
import { installDatagrid } from '../../src/core/datagrid.js';
import { installFieldErrors } from '../../src/core/field-errors.js';

afterEach(() => {
  Flux.dispose();
  document.body.innerHTML = '';
  localStorage.clear();
});

describe('server-driven action pipeline (flux:action)', () => {
  it('runs a pipeline dispatched via HX-Trigger-style event', () => {
    const teardown = installServerActions();
    const spy = vi.fn();
    const unregister = registerAction('srv-test', spy);
    document.dispatchEvent(
      new CustomEvent('flux:action', { detail: { actions: 'srv-test:hello' } }),
    );
    expect(spy).toHaveBeenCalledWith('hello', expect.anything(), expect.anything());
    unregister();
    teardown();
  });

  it('invalidate action clears matching cache entries', () => {
    cache.set('GET:/containers/list', '<div>x</div>');
    const teardown = installServerActions();
    document.dispatchEvent(
      new CustomEvent('flux:action', { detail: { actions: 'invalidate:GET:/containers/*' } }),
    );
    expect(cache.get('GET:/containers/list')).toBeNull();
    teardown();
  });
});

describe('fx-field-errors', () => {
  it('populates slots, marks inputs, focuses first, and clears on input', () => {
    const teardown = installFieldErrors();
    document.body.innerHTML = `
      <form fx-submit="/users" fx-field-errors>
        <input name="email" /><span data-field-error="email"></span>
        <input name="port" /><span data-field-error="port"></span>
      </form>`;
    const form = document.querySelector('form')!;
    const email = form.querySelector('[name="email"]')!;
    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: { sourceElement: form, source: form, successful: false },
          xhr: { status: 422, responseText: '{"email":"already taken","port":"1-65535"}' },
        },
      }),
    );
    expect(form.querySelector('[data-field-error="email"]')!.textContent).toBe('already taken');
    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(email);

    email.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.querySelector('[data-field-error="email"]')!.textContent).toBe('');
    expect(email.hasAttribute('aria-invalid')).toBe(false);
    teardown();
  });
});

describe('datagrid controllers', () => {
  it('fx-sort cycles sort state, syncs aria-sort, and requests with sort params', () => {
    const teardown = installDatagrid();
    const ajax = vi.fn();
    (window as any).htmx = { ajax };
    document.body.innerHTML = `
      <table fx-sort-url="/rows" hx-target="#r"><thead>
        <th fx-sort="name">Name</th></thead></table><div id="r"></div>`;
    const th = document.querySelector('th')!;
    th.click();
    expect(th.getAttribute('aria-sort')).toBe('ascending');
    expect(ajax).toHaveBeenCalledWith('GET', '/rows?sort=name&dir=asc', expect.anything());
    th.click();
    expect(th.getAttribute('aria-sort')).toBe('descending');
    th.click();
    expect(th.hasAttribute('aria-sort')).toBe(false);
    teardown();
  });

  it('fx-include-selection appends checked values and gates the button', () => {
    const teardown = installDatagrid();
    document.body.innerHTML = `
      <table id="t"><tr><td><input type="checkbox" fx-select name="id" value="7" checked /></td></tr></table>
      <button fx-post="/stop" fx-include-selection="#t">Stop</button>`;
    const btn = document.querySelector('button')!;
    document.body.dispatchEvent(new Event('change', { bubbles: true }));

    const params: Record<string, unknown> = {};
    const detail = {
      ctx: {
        source: btn,
        request: { parameters: params as Record<string, unknown>, method: 'POST', action: '/stop' },
      },
    };
    document.dispatchEvent(new CustomEvent('htmx:config:request', { detail }));
    expect(params['id']).toEqual(['7']);

    const cb = document.querySelector('input') as HTMLInputElement;
    cb.checked = false;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(btn.disabled).toBe(true);
    teardown();
  });
});

describe('fx-idempotency-key', () => {
  it('sends one stable key per element across requests', async () => {
    Flux.configure();
    const seen: string[] = [];
    document.addEventListener('htmx:config:request', (e) => {
      const h = (e as CustomEvent).detail?.ctx?.request?.headers;
      if (h && h['Idempotency-Key']) seen.push(h['Idempotency-Key']);
    });
    const form = document.createElement('form');
    form.setAttribute('fx-idempotency-key', '');
    document.body.appendChild(form);
    for (let i = 0; i < 2; i++) {
      form.dispatchEvent(
        new CustomEvent('htmx:config:request', {
          bubbles: true,
          detail: {
            ctx: { source: form, request: { method: 'POST', action: '/deploy', headers: {} } },
          },
        }),
      );
    }
    expect(seen.length).toBe(2);
    expect(seen[0]).toBe(seen[1]);
    Flux.dispose();
  });
});
