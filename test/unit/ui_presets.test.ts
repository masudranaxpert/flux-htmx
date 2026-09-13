import { afterEach, describe, expect, it, vi } from 'vitest';
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
} from '../../src/presets/ui.js';

function makeEl(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as HTMLElement;
}

// Visibility presets share ONE mechanism: the `hidden` class. fx-show removes it,
// fx-hide adds it, fx-toggle toggles it — so any combination composes.
describe('fx-show / fx-hide / fx-toggle target wiring', () => {
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
