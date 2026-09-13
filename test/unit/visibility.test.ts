import './setup.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyShow,
  applyHide,
  applyToggle,
  applyClassToggle,
  applyRemove,
  disconnectShow,
  disconnectHide,
  disconnectToggle,
  disconnectClassToggle,
  applyDropdown,
  disconnectDropdown,
} from '../../src/presets/ui.js';
import { applyPreset, disposePresetControllers } from '../../src/presets/index.js';
import * as Flux from '../../src/flux.js';
import {
  disposeDialogControllers,
  installOpenController,
  safeQuerySelector,
} from '../../src/components/components.js';
import { installValidation } from '../../src/core/validation.js';
import { resetFeedbackForTests } from '../../src/core/feedback.js';
import { cache } from '../../src/cache/instance.js';

function makeEl(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as HTMLElement;
}

const ctxFor = (el: Element) => (attr: string) => el.getAttribute(attr) ?? undefined;

// fx-dropdown attaches document-level listeners; track every trigger so afterEach can tear
// them down and stop listeners bleeding between tests.
const triggers: HTMLElement[] = [];
const dropdown = (trigger: HTMLElement, sel?: string) => {
  applyDropdown(trigger, sel);
  triggers.push(trigger);
};

// Visibility presets share ONE mechanism: the `hidden` class. fx-show removes it,
// fx-hide adds it, fx-toggle toggles it — so any combination composes.
describe('visibility presets (fx-show / fx-hide / fx-toggle)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fx-show="#t" removes the hidden class from the resolved target', () => {
    const button = makeEl('<button fx-show="#t">show</button>');
    const target = makeEl('<div id="t" class="hidden"></div>');
    document.body.append(button, target);

    applyShow(button, '#t');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(target.classList.contains('hidden')).toBe(false);
  });

  it('fx-hide="#t" adds the hidden class to the resolved target', () => {
    const button = makeEl('<button fx-hide="#t">hide</button>');
    const target = makeEl('<div id="t"></div>');
    document.body.append(button, target);

    applyHide(button, '#t');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(target.classList.contains('hidden')).toBe(true);
  });

  it('fx-toggle="#t" toggles the hidden class on the resolved target', () => {
    const button = makeEl('<button fx-toggle="#t">toggle</button>');
    const target = makeEl('<div id="t"></div>');
    document.body.append(button, target);
    expect(target.classList.contains('hidden')).toBe(false);

    applyToggle(button, '#t');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(target.classList.contains('hidden')).toBe(true);

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(target.classList.contains('hidden')).toBe(false);
  });

  it('fx-class-toggle="#t" with a class toggles that class on the resolved target', () => {
    const button = makeEl('<button fx-class-toggle="#t">toggle</button>');
    const target = makeEl('<div id="t"></div>');
    document.body.append(button, target);

    applyClassToggle(button, 'is-open', '#t');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(target.classList.contains('is-open')).toBe(true);

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(target.classList.contains('is-open')).toBe(false);
  });

  it('no target selector acts on the triggering element itself', () => {
    const button = makeEl('<button>toggle</button>');
    document.body.append(button);

    applyToggle(button);
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(button.classList.contains('hidden')).toBe(true);
  });

  it('does not throw when the selector matches nothing', () => {
    const button = makeEl('<button fx-show="#missing">show</button>');
    document.body.append(button);

    expect(() => {
      applyShow(button, '#missing');
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }).not.toThrow();
  });

  it('visibility mechanisms compose: a target hidden by fx-hide is shown by fx-show', () => {
    const hideBtn = makeEl('<button fx-hide="#panel">hide</button>');
    const showBtn = makeEl('<button fx-show="#panel">show</button>');
    const panel = makeEl('<div id="panel"></div>');
    document.body.append(hideBtn, showBtn, panel);

    applyHide(hideBtn, '#panel');
    applyShow(showBtn, '#panel');

    hideBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(panel.classList.contains('hidden')).toBe(true);

    showBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(panel.classList.contains('hidden')).toBe(false);
  });
});

// Regression: signature changes used to re-run applyPreset without a disconnect, so
// listeners stacked — an even count made fx-toggle a visual no-op.
describe('visibility preset disconnects', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reconnecting fx-toggle does not stack click listeners', () => {
    const button = makeEl('<button>toggle</button>');
    const target = makeEl('<div id="t"></div>');
    document.body.append(button, target);

    applyToggle(button, '#t');
    applyToggle(button, '#t');
    applyToggle(button, '#t');

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(target.classList.contains('hidden')).toBe(true);

    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(target.classList.contains('hidden')).toBe(false);
  });

  it('disconnectShow / disconnectHide / disconnectToggle / disconnectClassToggle remove the listener', () => {
    const showBtn = makeEl('<button>show</button>');
    const hideBtn = makeEl('<button>hide</button>');
    const toggleBtn = makeEl('<button>toggle</button>');
    const classBtn = makeEl('<button>class</button>');
    const showTarget = makeEl('<div id="a" class="hidden"></div>');
    const hideTarget = makeEl('<div id="b"></div>');
    const toggleTarget = makeEl('<div id="c"></div>');
    const classTarget = makeEl('<div id="d"></div>');
    document.body.append(
      showBtn,
      hideBtn,
      toggleBtn,
      classBtn,
      showTarget,
      hideTarget,
      toggleTarget,
      classTarget,
    );

    applyShow(showBtn, '#a');
    applyHide(hideBtn, '#b');
    applyToggle(toggleBtn, '#c');
    applyClassToggle(classBtn, 'is-on', '#d');

    disconnectShow(showBtn);
    disconnectHide(hideBtn);
    disconnectToggle(toggleBtn);
    disconnectClassToggle(classBtn);

    showBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    hideBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    toggleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    classBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(showTarget.classList.contains('hidden')).toBe(true);
    expect(hideTarget.classList.contains('hidden')).toBe(false);
    expect(toggleTarget.classList.contains('hidden')).toBe(false);
    expect(classTarget.classList.contains('is-on')).toBe(false);
  });
});

// Regression: fx-remove is the SELF-REMOVAL preset. A non-duration value (e.g. the
// "closest li" that belongs on fx-remove-target) used to parse as NaN and destroy the
// element immediately on page load.
describe('fx-remove self-removal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('removes the element after the given delay', () => {
    vi.useFakeTimers();
    const el = makeEl('<div fx-remove="3s">toast</div>');
    document.body.append(el);

    applyRemove(el, '3s');
    expect(el.isConnected).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(el.isConnected).toBe(false);
  });

  it('ignores non-duration values instead of removing the element', () => {
    vi.useFakeTimers();
    const el = makeEl('<button>delete me</button>');
    document.body.append(el);

    expect(applyRemove(el, 'closest li')).toBe(false);
    vi.runAllTimers();
    expect(el.isConnected).toBe(true);
  });

  it('ignores empty values instead of removing immediately', () => {
    vi.useFakeTimers();
    const el = makeEl('<button>keep me</button>');
    document.body.append(el);

    expect(applyRemove(el, '')).toBe(false);
    vi.runAllTimers();
    expect(el.isConnected).toBe(true);
  });
});

describe('fx-dropdown', () => {
  afterEach(() => {
    triggers.splice(0).forEach(disconnectDropdown);
    disposePresetControllers();
    document.body.innerHTML = '';
  });

  it('toggles the hidden class on the target on trigger click', () => {
    const trigger = makeEl('<button fx-dropdown="#menu">Toggle</button>');
    const menu = makeEl('<ul id="menu" class="hidden"></ul>');
    document.body.append(trigger, menu);
    dropdown(trigger, '#menu');
    expect(menu.classList.contains('hidden')).toBe(true);

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.classList.contains('hidden')).toBe(false);

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.classList.contains('hidden')).toBe(true);
  });

  // Regression: the opening click used to bubble to the document and trigger the async
  // outside-close while the opener's fadeIn was still running — a race the opening click
  // usually lost. fx-dropdown excludes the trigger from outside-close, so it stays open.
  it('does not close on the opening click (race regression)', () => {
    const trigger = makeEl('<button fx-dropdown="#menu">Toggle</button>');
    const menu = makeEl('<ul id="menu" class="hidden"></ul>');
    document.body.append(trigger, menu);
    dropdown(trigger, '#menu');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.classList.contains('hidden')).toBe(false);
  });

  it('closes on a click outside the trigger and target', () => {
    const trigger = makeEl('<button fx-dropdown="#menu">Toggle</button>');
    const menu = makeEl('<ul id="menu" class="hidden"></ul>');
    const away = makeEl('<div id="elsewhere">elsewhere</div>');
    document.body.append(trigger, menu, away);
    dropdown(trigger, '#menu');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })); // open
    expect(menu.classList.contains('hidden')).toBe(false);

    away.dispatchEvent(new MouseEvent('click', { bubbles: true })); // outside -> close
    expect(menu.classList.contains('hidden')).toBe(true);
  });

  it('stays open when clicking inside the target', () => {
    const trigger = makeEl('<button fx-dropdown="#menu">Toggle</button>');
    const menu = makeEl('<ul id="menu" class="hidden"><li id="item">x</li></ul>');
    document.body.append(trigger, menu);
    dropdown(trigger, '#menu');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })); // open

    document.getElementById('item')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(menu.classList.contains('hidden')).toBe(false);
  });

  it('closes on Escape', () => {
    const trigger = makeEl('<button fx-dropdown="#menu">Toggle</button>');
    const menu = makeEl('<ul id="menu" class="hidden"></ul>');
    document.body.append(trigger, menu);
    dropdown(trigger, '#menu');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })); // open
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.classList.contains('hidden')).toBe(true);
  });

  it('keeps aria-expanded in sync with the open state', () => {
    const trigger = makeEl('<button fx-dropdown="#menu" aria-expanded="false">Toggle</button>');
    const menu = makeEl('<ul id="menu" class="hidden"></ul>');
    document.body.append(trigger, menu);
    dropdown(trigger, '#menu');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true })); // open
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('removes every listener on disconnect', () => {
    const trigger = makeEl('<button fx-dropdown="#menu">Toggle</button>');
    const menu = makeEl('<ul id="menu" class="hidden"></ul>');
    document.body.append(trigger, menu);
    applyDropdown(trigger, '#menu'); // not tracked: we disconnect explicitly below.

    disconnectDropdown(trigger);

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // No listener fired: the closed menu stayed closed.
    expect(menu.classList.contains('hidden')).toBe(true);
  });

  // Guards the fix: fx-dropdown belongs to the visibility group, so a trigger cannot also
  // carry fx-show (whose async fadeIn would race the toggle). fx-dropdown wins as primary.
  it('wins the visibility group over fx-show', () => {
    const trigger = makeEl('<button fx-dropdown="#m" fx-show="#m">Toggle</button>');
    const menu = makeEl('<div id="m" class="hidden"></div>');
    document.body.append(trigger, menu);
    const ctx = ctxFor(trigger);

    expect(applyPreset(trigger, 'fx-dropdown', '#m', ctx)).toBe(true);
    expect(applyPreset(trigger, 'fx-show', '#m', ctx)).toBe(false);
  });
});

describe('custom confirmation dialog (fx-confirm-dialog)', () => {
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

describe('invalid form never opens the confirm dialog', () => {
  beforeEach(() => {
    Flux.dispose();
    document.body.innerHTML = '';
  });

  it('validation drop short-circuits the fx-confirm-dialog controller', () => {
    installValidation();
    const openTeardown = installOpenController();

    const form = makeEl(
      '<form fx-validate><button id="sub" fx-confirm-dialog="#dlg">Go</button></form>',
    ) as HTMLFormElement;
    form.reportValidity = vi.fn(() => false);
    const dialog = makeEl('<dialog id="dlg"><button data-flux-confirm>OK</button></dialog>');
    const showModal = vi.fn();
    (dialog as HTMLDialogElement).showModal = showModal;
    document.body.append(form, dialog);

    const evt = new CustomEvent('htmx:confirm', {
      bubbles: true,
      cancelable: true,
      detail: {
        elt: document.querySelector('#sub'),
        ctx: { sourceElement: document.querySelector('#sub') },
        issueRequest: vi.fn(),
        dropRequest: vi.fn(),
      },
    });
    document.dispatchEvent(evt);

    expect(showModal).not.toHaveBeenCalled();
    expect(evt.detail.issueRequest).not.toHaveBeenCalled();

    openTeardown();
  });
});

describe('confirm dialog request lifecycle', () => {
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

  it('Active confirm dialog drops pending request on Flux.dispose()', () => {
    Flux.dispose();
    Flux.configure();

    const dialog = makeEl(`
      <dialog id="confirm-modal">
        <button class="confirm" data-flux-confirm>Yes</button>
      </dialog>
    `) as HTMLDialogElement;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    document.body.appendChild(dialog);

    const button = makeEl(
      '<button fx-get="/del" fx-confirm-dialog="#confirm-modal">Delete</button>',
    );
    document.body.appendChild(button);

    let dropped = false;
    button.dispatchEvent(
      new CustomEvent('htmx:confirm', {
        bubbles: true,
        detail: {
          elt: button,
          issueRequest: () => {},
          dropRequest: () => {
            dropped = true;
          },
        },
      }),
    );

    Flux.dispose();
    expect(dropped).toBe(true);
    expect(dialog.close).toHaveBeenCalled();
  });

  it('Cancels pending confirmation controller on new confirmation opening on same dialog', () => {
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

  it('Drops previous pending request when a new confirmation replaces it', () => {
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

  it('Confirm dialog cancellation drops request', () => {
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
});

describe('components safeQuerySelector and fx-close controller', () => {
  it('guards against invalid CSS selectors without throwing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(safeQuerySelector('[')).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('closes dialog on fx-close click', () => {
    const teardown = installOpenController();
    const dialog = document.createElement('dialog');
    dialog.close = vi.fn();
    document.body.appendChild(dialog);

    const closeBtn = makeEl('<button fx-close></button>');
    dialog.appendChild(closeBtn);

    closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.close).toHaveBeenCalled();

    teardown();
  });
});

describe('fx-toast', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    cache.clear();
    document.body.innerHTML = '';
    resetFeedbackForTests();
    Flux.configure();
  });

  it('fx-toast: shows a visible toast element when fx-toast is present', async () => {
    const el = makeEl('<button fx-post="/delete" fx-toast fx-error="Action failed">Click</button>');
    document.body.appendChild(el);
    Flux.process(document.body);

    el.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          xhr: {},
          successful: false,
          isError: true,
          elt: el,
          requestConfig: { verb: 'post' },
        },
      }),
    );

    // Toast should be appended to body
    const toast = document.querySelector('.flux-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain('Action failed');
    expect(toast?.classList.contains('flux-toast-error')).toBe(true);
  });
});

describe('fx-confirm-dialog attribute wiring', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    resetFeedbackForTests();
    vi.unstubAllGlobals();
  });

  it('validates without hx-confirm and creates a confirmation sentinel only for dialogs', () => {
    Flux.configure();
    const form = makeEl('<form fx-submit="/users" fx-validate></form>') as HTMLFormElement;
    form.reportValidity = vi.fn(() => false);
    const button = makeEl(
      '<button fx-delete="/users/1" fx-confirm-dialog="#confirm-modal"></button>',
    );
    document.body.append(form, button);
    Flux.process(document.body);

    const requestEvent = new CustomEvent('htmx:config:request', {
      bubbles: true,
      cancelable: true,
      detail: { ctx: { sourceElement: form, request: { method: 'POST', action: '/users' } } },
    });
    form.dispatchEvent(requestEvent);

    expect(requestEvent.defaultPrevented).toBe(true);
    expect(button.getAttribute('hx-confirm')).toBe('flux-confirm-dialog');
  });

  it('restores fx-confirm in the same pass after fx-confirm-dialog is removed', () => {
    Flux.configure();
    const button = makeEl(
      '<button fx-delete="/users/1" fx-confirm="Sure?" fx-confirm-dialog="#dialog"></button>',
    );
    document.body.appendChild(button);
    Flux.process(button);
    expect(button.getAttribute('hx-confirm')).toBe('flux-confirm-dialog');

    button.removeAttribute('fx-confirm-dialog');
    Flux.process(button);

    expect(button.getAttribute('hx-confirm')).toBe('Sure?');
  });
});

describe('dialog close listener disposal', () => {
  it('cleans up element-level dialog close controllers on dispose', () => {
    const teardown = installOpenController();
    const dialog = document.createElement('dialog');
    dialog.id = 'test-dialog';
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    document.body.appendChild(dialog);

    const openBtn = makeEl('<button fx-open="#test-dialog"></button>');
    document.body.appendChild(openBtn);

    openBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.getAttribute('data-flux-close-wired')).toBe('1');

    disposeDialogControllers();
    expect(dialog.hasAttribute('data-flux-close-wired')).toBe(false);

    teardown();
  });
});
