import './setup.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { installDatagrid } from '../../src/core/datagrid.js';
import { installPollVisibilityPause } from '../../src/presets/poll.js';
import { setGeneratedAttribute } from '../../src/core/generated-attributes.js';
import { installPersist } from '../../src/plugins/persist.js';

const htmx4 = (source: Element, extra: Record<string, unknown> = {}) => ({
  ctx: { sourceElement: source, ...extra },
});

afterEach(() => {
  Flux.dispose();
  document.body.innerHTML = '';
});

describe('regression battery (past-release bugs)', () => {
  it('poll: hidden -> visible cycle preserves hx-get', () => {
    const htmxMock = { process: vi.fn(), ajax: vi.fn() };
    const win = window as unknown as { htmx?: unknown };
    win.htmx = htmxMock;
    const teardown = installPollVisibilityPause();
    document.body.innerHTML = '<div data-flux-preset="poll"></div>';
    const el = document.querySelector('[data-flux-preset="poll"]')!;
    setGeneratedAttribute(el, 'hx-get', '/status'); // registry-owned, as applyPoll writes it
    setGeneratedAttribute(el, 'hx-trigger', 'every 5s');
    const stub = (v: string) =>
      Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });
    stub('hidden');
    expect(document.visibilityState).toBe('hidden'); // stub effective?
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.getAttribute('hx-trigger')).toBe('none');
    stub('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(el.getAttribute('hx-get')).toBe('/status');
    expect(el.getAttribute('hx-trigger')).toBe('every 5s');
    teardown();
    delete win.htmx;
  });

  it('fx-ago: ISO in textContent survives first render', () => {
    Flux.configure();
    const iso = '2020-01-01T00:00:00Z';
    document.body.innerHTML = `<time fx-ago>${iso}</time>`;
    document.dispatchEvent(new CustomEvent('htmx:after:settle'));
    const el = document.querySelector('time')!;
    expect(el.textContent).not.toBe('');
    expect(el.dataset.fluxAgoSrc).toBe(iso);
  });

  it('datagrid: request with no fx-include-selection throws nothing', () => {
    const teardown = installDatagrid();
    document.body.innerHTML = '<button fx-post="/x">Go</button>';
    const btn = document.querySelector('button')!;
    expect(() =>
      document.dispatchEvent(new CustomEvent('htmx:config:request', { detail: htmx4(btn) })),
    ).not.toThrow();
    teardown();
  });

  it('sync-url: 5 consecutive updates from one form -> exactly 1 pushState', () => {
    const teardown = installDatagrid();
    document.body.innerHTML = '<form fx-search="/q" fx-sync-url><input name="q" /></form>';
    const form = document.querySelector('form')!;
    const pushes = vi.spyOn(history, 'pushState');
    for (let i = 0; i < 5; i++) {
      (form.querySelector('input') as HTMLInputElement).value = `n${i}`;
      form.dispatchEvent(
        new CustomEvent('htmx:after:request', { bubbles: true, detail: htmx4(form) }),
      );
    }
    expect(pushes).toHaveBeenCalledTimes(1);
    pushes.mockRestore();
    teardown();
  });

  it('idempotency: retry reuses the key; a fresh submit does not', () => {
    Flux.configure();
    const keys: string[] = [];
    document.addEventListener('htmx:config:request', (e) => {
      const h = (e as CustomEvent).detail?.ctx?.request?.headers;
      if (h?.['Idempotency-Key']) keys.push(h['Idempotency-Key']);
    });
    const form = document.createElement('form');
    form.setAttribute('fx-idempotency-key', '');
    document.body.appendChild(form);
    const fire = (headers: Record<string, string>) =>
      form.dispatchEvent(
        new CustomEvent('htmx:config:request', {
          detail: {
            ctx: { sourceElement: form, request: { method: 'POST', action: '/go', headers } },
          },
          bubbles: true,
        }),
      );
    fire({});
    fire({ 'X-Flux-Retry': 'true' }); // retry chain
    fire({}); // fresh submit
    expect(keys.length).toBe(3);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('shortcut: bare-letter binding does not fire inside an input', () => {
    Flux.configure();
    document.body.innerHTML = `<input /><button fx-shortcut="k" id="s">K</button>`;
    const spy = vi.fn();
    document.getElementById('s')!.addEventListener('click', spy);
    const input = document.querySelector('input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
    // outside inputs it fires
    document
      .getElementById('s')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fx-open: non-dialog, non-popover target warns instead of throwing', () => {
    Flux.configure();
    const originalShowPopover = HTMLElement.prototype.showPopover;
    const showPopoverSpy = vi.fn(function (this: HTMLElement) {
      if (!this.hasAttribute('popover')) {
        throw new DOMException('bad', 'InvalidStateError');
      }
    });
    HTMLElement.prototype.showPopover = showPopoverSpy;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      document.body.innerHTML = `<button fx-open="#plain">Open</button><div id="plain"></div>`;
      document.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(showPopoverSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[flux]'),
        expect.stringContaining('target must be a <dialog> or declare the popover attribute'),
      );
    } finally {
      HTMLElement.prototype.showPopover = originalShowPopover;
      warnSpy.mockRestore();
    }
  });

  it('modal: detail===0 click does not close the dialog', () => {
    Flux.configure();
    document.body.innerHTML = `<dialog id="m" fx-modal open><p>x</p></dialog>`;
    const dialog = document.getElementById('m') as HTMLDialogElement;
    dialog.close = function () {
      this.open = false;
      this.removeAttribute('open');
    };
    dialog.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 100,
        right: 400,
        bottom: 300,
        width: 300,
        height: 200,
        x: 100,
        y: 100,
      }) as DOMRect;
    dialog.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 0, clientX: 0, clientY: 0 }),
    );
    expect(dialog.open).toBe(true);
    dialog.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 5, clientY: 5 }),
    );
    expect(dialog.open).toBe(false);
  });

  it('persist: repeated installs leave one listener, not four', () => {
    installPersist();
    installPersist();
    installPersist();
    localStorage.setItem('fx-persist:k', 'v');
    document.body.innerHTML = `<input fx-persist="k" value="v" />`;
    const input = document.querySelector('input')!;
    let restored = 0;
    input.addEventListener('flux:persist:restored', () => restored++);
    document.dispatchEvent(new CustomEvent('htmx:after:settle', { detail: { el: document.body } }));
    expect(restored).toBe(1);
  });

  it('fx-delete + fx-remove: button with selector remains in DOM (NaN does not remove)', () => {
    vi.useFakeTimers();
    try {
      document.body.innerHTML = `<ul><li><button fx-delete="/i/1" fx-remove="closest li">del</button></li></ul>`;
      Flux.process(document.body);
      vi.advanceTimersByTime(700);
      expect(document.querySelector('button')?.isConnected).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
