import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyShow, applyHide, applyToggle, applyClassToggle } from '../../src/presets/ui.js';

function makeEl(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as HTMLElement;
}

// Regression: fx-show/fx-hide/fx-toggle/fx-class-toggle with a selector target used to
// call the per-node sugar method (fadeIn/fadeOut/classToggle) on the ARRAY returned by any(),
// throwing "n.fadeIn is not a function". They must iterate and act on each matched node.
describe('fx-show / fx-hide / fx-toggle target wiring', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fx-show="#t" calls fadeIn on the resolved target (not the array)', () => {
    const button = makeEl('<button fx-show="#t">show</button>');
    const target = makeEl('<div id="t"></div>');
    document.body.append(button, target);
    // Pin the target so sugar() is a no-op and our stub survives the click handler.
    const stubbed = Object.assign(target, { hasSurreal: true, fadeIn: vi.fn() });

    applyShow(button, '#t');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(stubbed.fadeIn).toHaveBeenCalledTimes(1);
  });

  it('fx-hide="#t" calls fadeOut on the resolved target', () => {
    const button = makeEl('<button fx-hide="#t">hide</button>');
    const target = makeEl('<div id="t"></div>');
    document.body.append(button, target);
    const stubbed = Object.assign(target, { hasSurreal: true, fadeOut: vi.fn() });

    applyHide(button, '#t');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(stubbed.fadeOut).toHaveBeenCalledTimes(1);
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
});
