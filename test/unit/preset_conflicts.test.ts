import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPreset, disposePresetControllers } from '../../src/presets/index.js';
import { inspectElement } from '../../src/diagnostics/doctor.js';

function makeEl(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as HTMLElement;
}

const ctxFor = (el: Element) => (attr: string) => el.getAttribute(attr) ?? undefined;

describe('preset conflict groups', () => {
  afterEach(() => {
    disposePresetControllers();
    document.body.innerHTML = '';
  });

  // Regression: fx-hide-escape + fx-hide-outside used to be flagged as conflicting and the
  // secondary (fx-hide-outside) was silently dropped — outside-click close never attached.
  it('lets fx-hide-escape and fx-hide-outside coexist on one element', () => {
    const panel = makeEl('<div id="p" fx-hide-escape fx-hide-outside></div>');
    document.body.append(panel);
    const ctx = ctxFor(panel);

    expect(applyPreset(panel, 'fx-hide-escape', 'this', ctx)).toBe(true);
    expect(applyPreset(panel, 'fx-hide-outside', 'this', ctx)).toBe(true);
  });

  it('keeps fx-show / fx-hide mutually exclusive (visibility group)', () => {
    const trigger = makeEl('<button fx-show="#t" fx-hide="#t"></button>');
    const target = makeEl('<div id="t"></div>');
    document.body.append(trigger, target);
    const ctx = ctxFor(trigger);

    expect(applyPreset(trigger, 'fx-show', '#t', ctx)).toBe(true);
    // fx-hide is the secondary visibility member -> skipped.
    expect(applyPreset(trigger, 'fx-hide', '#t', ctx)).toBe(false);
  });

  it('keeps request presets (fx-load / fx-poll) mutually exclusive', () => {
    const el = makeEl('<div fx-load="/a" fx-poll="/b" fx-interval="2s"></div>');
    document.body.append(el);
    const ctx = ctxFor(el);

    expect(applyPreset(el, 'fx-load', '/a', ctx)).toBe(true);
    expect(applyPreset(el, 'fx-poll', '/b', ctx)).toBe(false);
  });

  it('is idempotent: re-applying the same preset with no change is a no-op', () => {
    const panel = makeEl('<div fx-hide-escape></div>');
    document.body.append(panel);
    const ctx = ctxFor(panel);

    expect(applyPreset(panel, 'fx-hide-escape', 'this', ctx)).toBe(true);
    expect(applyPreset(panel, 'fx-hide-escape', 'this', ctx)).toBe(false);
  });

  it('reconnects when the preset value changes', () => {
    const panel = makeEl('<div fx-hide-escape></div>');
    document.body.append(panel);
    const ctx = ctxFor(panel);

    expect(applyPreset(panel, 'fx-hide-escape', 'this', ctx)).toBe(true);
    expect(applyPreset(panel, 'fx-hide-escape', '#other', ctx)).toBe(true);
  });

  it('disconnects every coexisting controller on dispose', () => {
    const panel = makeEl('<div fx-hide-escape fx-hide-outside></div>');
    document.body.append(panel);
    const ctx = ctxFor(panel);
    applyPreset(panel, 'fx-hide-escape', 'this', ctx);
    applyPreset(panel, 'fx-hide-outside', 'this', ctx);

    const removeSpy = vi.spyOn(document, 'removeEventListener');
    disposePresetControllers();
    const removed = removeSpy.mock.calls.map((c) => c[0]);
    expect(removed).toEqual(expect.arrayContaining(['keydown', 'click']));
    removeSpy.mockRestore();
  });
});

describe('doctor conflict diagnostics', () => {
  it('does not flag complementary fx-hide-escape + fx-hide-outside', () => {
    const panel = makeEl('<div fx-hide-escape fx-hide-outside></div>');
    document.body.append(panel);

    const result = inspectElement(panel);
    expect(result.warnings.some((w) => w.includes('conflict'))).toBe(false);
  });

  it('flags a genuine fx-show + fx-hide conflict with the group name', () => {
    const trigger = makeEl('<button fx-show="#t" fx-hide="#t"></button>');
    document.body.append(trigger);

    const result = inspectElement(trigger);
    const conflict = result.warnings.find(
      (w) => w.includes('conflict') && w.includes('visibility'),
    );
    expect(conflict).toBeTruthy();
    expect(conflict).toContain('fx-show');
    expect(conflict).toContain('fx-hide');
  });
});
