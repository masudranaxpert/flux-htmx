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

  it('modal: respects closedby="none" and closedby="closerequest" (does not dismiss on backdrop click)', () => {
    Flux.configure();
    document.body.innerHTML = `
      <dialog id="m-none" fx-modal closedby="none" open><p>x</p></dialog>
      <dialog id="m-req" fx-modal closedby="closerequest" open><p>y</p></dialog>
    `;
    const mNone = document.getElementById('m-none') as HTMLDialogElement;
    const mReq = document.getElementById('m-req') as HTMLDialogElement;
    const fakeRect = () =>
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
    mNone.getBoundingClientRect = fakeRect;
    mReq.getBoundingClientRect = fakeRect;

    // Outside click (clientX: 5, clientY: 5)
    mNone.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 5, clientY: 5 }),
    );
    expect(mNone.open).toBe(true); // closedby="none" protects it

    mReq.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 5, clientY: 5 }),
    );
    expect(mReq.open).toBe(true); // closedby="closerequest" protects it (only Escape should close)
  });

  it('modal: prompts before backdrop dismiss if dialog contains a dirty form', () => {
    Flux.configure();
    document.body.innerHTML = `
      <dialog id="m-dirty" fx-modal open>
        <form fx-dirty data-dirty="true"><input name="title" /></form>
      </dialog>
    `;
    const dialog = document.getElementById('m-dirty') as HTMLDialogElement;
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

    const confirmSpy = vi.spyOn(window, 'confirm');

    // 1. User cancels confirm -> dialog stays open
    confirmSpy.mockReturnValueOnce(false);
    dialog.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 5, clientY: 5 }),
    );
    expect(confirmSpy).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(dialog.open).toBe(true);

    // 2. User accepts confirm -> dialog closes
    confirmSpy.mockReturnValueOnce(true);
    dialog.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 5, clientY: 5 }),
    );
    expect(dialog.open).toBe(false);

    confirmSpy.mockRestore();
  });

  it('modal: custom fx-dirty-message attribute and config messages are honored on backdrop dismiss', () => {
    Flux.configure({ messages: { unsavedChanges: 'Global unsaved prompt' } });
    document.body.innerHTML = `
      <dialog id="m-attr" fx-modal fx-dirty-message="Local modal prompt" open>
        <form fx-dirty data-dirty="true"><input name="x" /></form>
      </dialog>
      <dialog id="m-global" fx-modal open>
        <form fx-dirty data-dirty="true"><input name="y" /></form>
      </dialog>
    `;
    const mAttr = document.getElementById('m-attr') as HTMLDialogElement;
    const mGlobal = document.getElementById('m-global') as HTMLDialogElement;
    const fakeRect = () =>
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
    mAttr.getBoundingClientRect = fakeRect;
    mGlobal.getBoundingClientRect = fakeRect;

    const confirmSpy = vi.spyOn(window, 'confirm');

    // 1. Attribute override
    confirmSpy.mockReturnValueOnce(false);
    mAttr.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 5, clientY: 5 }),
    );
    expect(confirmSpy).toHaveBeenCalledWith('Local modal prompt');

    // 2. Global config message
    confirmSpy.mockReturnValueOnce(false);
    mGlobal.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 5, clientY: 5 }),
    );
    expect(confirmSpy).toHaveBeenCalledWith('Global unsaved prompt');

    confirmSpy.mockRestore();
  });

  it('widgets: onGuardedRequest allows submitting dirty form itself, but prompts on navigation away', () => {
    Flux.configure();
    document.body.innerHTML = `
      <form id="df" fx-dirty data-dirty="true" action="/save" method="post">
        <button type="submit" id="submit-btn">Save</button>
        <a href="/dashboard" id="cancel-link">Cancel and leave</a>
      </form>
      <button id="other-btn" hx-get="/other">Other</button>
    `;
    const form = document.getElementById('df')!;
    const submitBtn = document.getElementById('submit-btn')!;
    const cancelLink = document.getElementById('cancel-link')!;
    const otherBtn = document.getElementById('other-btn')!;

    const confirmSpy = vi.spyOn(window, 'confirm');

    // A. Submitting the dirty form directly via submit button -> NO confirm prompt
    submitBtn.dispatchEvent(
      new CustomEvent('htmx:before:request', { bubbles: true, detail: htmx4(submitBtn) }),
    );
    expect(confirmSpy).not.toHaveBeenCalled();

    // B. Submitting the form element itself -> NO confirm prompt
    form.dispatchEvent(
      new CustomEvent('htmx:before:request', { bubbles: true, detail: htmx4(form) }),
    );
    expect(confirmSpy).not.toHaveBeenCalled();

    // C. Navigating away via boosted link inside the form -> prompts with default message
    confirmSpy.mockReturnValueOnce(false);
    const leaveEvt = new CustomEvent('htmx:before:request', {
      cancelable: true,
      bubbles: true,
      detail: htmx4(cancelLink),
    });
    cancelLink.dispatchEvent(leaveEvt);
    expect(confirmSpy).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(leaveEvt.defaultPrevented).toBe(true);

    // D. Custom fx-dirty-message on the form is honored when navigating away
    form.setAttribute('fx-dirty-message', 'Custom leave prompt');
    confirmSpy.mockReturnValueOnce(true);
    const otherEvt = new CustomEvent('htmx:before:request', {
      cancelable: true,
      bubbles: true,
      detail: htmx4(otherBtn),
    });
    otherBtn.dispatchEvent(otherEvt);
    expect(confirmSpy).toHaveBeenCalledWith('Custom leave prompt');
    expect(otherEvt.defaultPrevented).toBe(false);

    confirmSpy.mockRestore();
  });

  it('core dirty tracking: form[fx-dirty] tracks input changes in core without full bundle', () => {
    Flux.configure();
    document.body.innerHTML = `
      <form id="test-dirty-core" fx-dirty>
        <input name="username" value="initial" />
      </form>
    `;
    const form = document.getElementById('test-dirty-core')!;
    // HTMX swaps dispatch htmx:after:settle to record original values
    document.dispatchEvent(
      new CustomEvent('htmx:after:settle', { detail: { ctx: { target: form } } }),
    );
    const input = form.querySelector('input')!;
    expect(form.hasAttribute('data-dirty')).toBe(false);

    // Change input value
    input.value = 'mutated';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(input.getAttribute('data-dirty')).toBe('true');
    expect(form.getAttribute('data-dirty')).toBe('true');

    // Restore original value
    input.value = 'initial';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(input.hasAttribute('data-dirty')).toBe(false);
    expect(form.hasAttribute('data-dirty')).toBe(false);
  });

  it('dirty tracking: unrelated htmx settle does not overwrite data-fx-original baseline', () => {
    Flux.configure();
    document.body.innerHTML = `
      <form id="keep-baseline" fx-dirty>
        <input name="item" value="clean" />
      </form>
      <div id="unrelated-target">toast</div>
    `;
    const form = document.getElementById('keep-baseline')!;
    const input = form.querySelector('input')!;
    // Initial settle records baseline
    document.dispatchEvent(
      new CustomEvent('htmx:after:settle', { detail: { ctx: { target: form } } }),
    );

    // User types into input -> form becomes dirty
    input.value = 'half typed';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.getAttribute('data-dirty')).toBe('true');

    // An unrelated settle occurs (e.g. fx-poll tick, toast, table row swap)
    const other = document.getElementById('unrelated-target')!;
    document.dispatchEvent(
      new CustomEvent('htmx:after:settle', { detail: { ctx: { target: other } } }),
    );
    // Baseline MUST NOT be rewritten to "half typed"
    expect(input.getAttribute('data-fx-original')).toBe('clean');

    // Restoring to clean baseline cleans the form
    input.value = 'clean';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(form.hasAttribute('data-dirty')).toBe(false);
  });

  it('modal: invalid closedby value warns and falls back to standard backdrop dismiss', () => {
    Flux.configure();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = `<dialog id="m-bad" fx-modal closedby="nono" open><p>x</p></dialog>`;
    const dialog = document.getElementById('m-bad') as HTMLDialogElement;
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

    // Outside click
    dialog.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 1, clientX: 5, clientY: 5 }),
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[flux]'),
      expect.stringContaining('invalid closedby="nono"'),
    );
    expect(dialog.open).toBe(false); // does not silently freeze
    warnSpy.mockRestore();
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
    document.dispatchEvent(
      new CustomEvent('htmx:after:settle', { detail: { ctx: { target: document.body } } }),
    );
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
