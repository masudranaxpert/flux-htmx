import './setup.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { me } from '../../src/core/sugar.js';
import { queryOne, queryMany, safeQuerySelector } from '../../src/core/selectors.js';
import {
  setGeneratedAttribute,
  getGeneratedAttributes,
  removeGeneratedAttributes,
} from '../../src/core/generated-attributes.js';
import { expandElement } from '../../src/core/expand.js';
import { isSuccessfulRequest, queryAllSafely } from '../../src/core/utils.js';
import { applySubmit } from '../../src/presets/submit.js';
import { doctor, inspectElement } from '../../src/diagnostics/doctor.js';
import { resetFeedbackForTests } from '../../src/core/feedback.js';
import pkg from '../../package.json';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

function makeElHtml(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as HTMLElement;
}

// Regression: fadeIn used to snapshot style.cssText and write it back at the end, which wiped any
// inline styles applied during the animation window (e.g. dropdown-flip positioning applied by the
// host app right after opening). It now restores only opacity/transition/overflow, so callers no
// longer need to delay their own style work until after the fade completes.
describe('sugar helpers (me / fadeIn)', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('keeps inline styles applied during the animation (dropdown-flip case)', async () => {
    const el = makeElHtml('<div class="hidden"></div>');
    document.body.append(el);

    vi.useFakeTimers();
    me(el)?.fadeIn(undefined, 20); // snapshot is taken synchronously here, before the flip below
    el.style.transform = 'translateX(50px)'; // host app flips mid-animation
    await vi.runAllTimersAsync();

    expect(el.style.transform).toBe('translateX(50px)'); // would be '' under the cssText wipe
    // Fade bookkeeping cleaned up afterwards; element left visible.
    expect(el.style.overflow).toBe('');
    expect(el.style.transition).toBe('');
    expect(el.classList.contains('hidden')).toBe(false);
  });
});

describe('safe selector utilities', () => {
  it('Selector Utility: queryOne and queryMany handle invalid selector syntax without throwing', () => {
    expect(queryOne('[invalid')).toBeNull();
    expect(queryMany('[invalid')).toEqual([]);
    expect(safeQuerySelector('[invalid')).toBeNull();
  });

  it('returns true for 2xx status and false for missing/error status', () => {
    expect(isSuccessfulRequest({ ctx: { successful: true } })).toBe(true);
    expect(isSuccessfulRequest({ ctx: { response: { status: 200 } } })).toBe(true);
    expect(isSuccessfulRequest({ ctx: { response: { status: 422 } } })).toBe(false);
    expect(isSuccessfulRequest(null)).toBe(false);
    expect(isSuccessfulRequest({})).toBe(false);
  });

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

describe('generated attribute registry', () => {
  it('Generated Attribute Registry: preserves user-written hx-* attributes and removes owned attributes', () => {
    const el = makeEl('<button hx-get="/raw" fx-get="/new">Click</button>');

    // User already declared raw hx-get
    const written = setGeneratedAttribute(el, 'hx-get', '/new');
    expect(written).toBe(false);
    expect(el.getAttribute('hx-get')).toBe('/raw');

    // Generated attribute owned by Flux
    const targetEl = makeEl('<button fx-target="#res">Click</button>');
    setGeneratedAttribute(targetEl, 'hx-target', '#res');
    expect(getGeneratedAttributes(targetEl).get('hx-target')).toBe('#res');

    removeGeneratedAttributes(targetEl);
    expect(targetEl.hasAttribute('hx-target')).toBe(false);
  });

  it('User attribute takeover detection: surrenders ownership when user mutates hx-* attribute', () => {
    const el = makeEl('<button fx-get="/initial">Click</button>');

    // Flux generates hx-get="/initial"
    setGeneratedAttribute(el, 'hx-get', '/initial');
    expect(getGeneratedAttributes(el).get('hx-get')).toBe('/initial');

    // User JS manually mutates attribute
    el.setAttribute('hx-get', '/manual-override');

    // Subsequent setGeneratedAttribute call should detect takeover and surrender ownership
    const written = setGeneratedAttribute(el, 'hx-get', '/initial');
    expect(written).toBe(false);
    expect(el.getAttribute('hx-get')).toBe('/manual-override');
    expect(getGeneratedAttributes(el).has('hx-get')).toBe(false);
  });

  it('Removes generated hx-* when source fx-* attribute is removed', () => {
    const el = makeEl('<button fx-get="/u">Click</button>');
    expandElement(el);
    expect(el.getAttribute('hx-get')).toBe('/u');

    el.removeAttribute('fx-get');
    expandElement(el);
    expect(el.hasAttribute('hx-get')).toBe(false);
  });
});

describe('doctor / inspect diagnostics', () => {
  it('Diagnostics API: Flux.inspect and Flux.doctor report element/runtime health', () => {
    const el = makeEl('<button fx-get="/test" fx-target="#res">Fetch</button>');
    document.body.appendChild(el);
    Flux.process(el);

    const insp = Flux.inspect(el);
    expect(insp.element).toBe(el);

    const report = Flux.doctor(document.body);
    expect(report.fluxVersion).toBe(pkg.version);
    expect(typeof report.elementsInspected).toBe('number');
  });

  it('Flux.doctor inspects preset elements correctly using [attribute] selectors', () => {
    const el = makeEl('<form fx-submit="/save"></form>');
    document.body.appendChild(el);

    const doc = doctor(document.body);
    expect(doc.elementsInspected).toBeGreaterThan(0);
  });

  it('Diagnostics API handles null input and inspects all registered preset attributes', () => {
    const nullInsp = inspectElement(null);
    expect(nullInsp.element).toBeNull();
    expect(nullInsp.warnings).toContain('A valid Element is required for inspection');

    const form = makeEl('<form fx-submit="/save"></form>');
    const insp = inspectElement(form);
    expect(insp.presets).toContain('fx-submit');

    const doc = doctor(document.body);
    expect(doc.fluxVersion).toBe(pkg.version);
  });

  it('Doctor inspects arbitrary fx-on-401 status selector rules', () => {
    const el = makeEl('<div fx-on-401="[invalid"></div>');
    document.body.appendChild(el);
    const report = Flux.doctor(document.body);
    expect(report.warnings.some((w) => w.includes('fx-on-401'))).toBe(true);
  });

  it('does not flag complementary fx-hide-escape + fx-hide-outside', () => {
    const panel = makeElHtml('<div fx-hide-escape fx-hide-outside></div>');
    document.body.append(panel);

    const result = inspectElement(panel);
    expect(result.warnings.some((w) => w.includes('conflict'))).toBe(false);
  });

  it('flags a genuine fx-show + fx-hide conflict with the group name', () => {
    const trigger = makeElHtml('<button fx-show="#t" fx-hide="#t"></button>');
    document.body.append(trigger);

    const result = inspectElement(trigger);
    const conflict = result.warnings.find(
      (w) => w.includes('conflict') && w.includes('visibility'),
    );
    expect(conflict).toBeTruthy();
    expect(conflict).toContain('fx-show');
    expect(conflict).toContain('fx-hide');
  });

  describe('doctor() ignores action pipeline values in status-selector warnings', () => {
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

    it('does not treat action pipelines as status selectors in doctor()', () => {
      const form = makeEl(
        '<form fx-post="/users" fx-on-success="toast:Saved; close:#modal"></form>',
      );
      document.body.appendChild(form);

      const report = Flux.doctor(document.body);

      expect(report.warnings.some((warning) => warning.includes('toast:Saved'))).toBe(false);
    });
  });
});
