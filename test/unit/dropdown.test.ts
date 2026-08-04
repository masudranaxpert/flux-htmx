import { afterEach, describe, expect, it } from 'vitest';
import { applyDropdown, disconnectDropdown } from '../../src/presets/ui.js';
import { applyPreset, disposePresetControllers } from '../../src/presets/index.js';

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
