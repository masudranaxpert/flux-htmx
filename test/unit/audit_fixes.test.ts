import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { registerPreset } from '../../src/presets/index.js';
import { expandElement } from '../../src/core/expand.js';
import { getGeneratedAttributes } from '../../src/core/generated-attributes.js';
import { doctor } from '../../src/diagnostics/doctor.js';

import { wireStatusTargeting } from '../../src/core/status.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('Audit Fixes P0, P1, P2 Test Suite', () => {
  it('1. P0-1: fx-disable is not expanded into hx-disable as a generic option', () => {
    const el = makeEl('<form fx-submit="/save" fx-disable="button[type=submit]"></form>');
    expandElement(el);
    expect(el.hasAttribute('hx-disable')).toBe(false);
  });

  it('2. P0-2: registerPreset prevents silent built-in override without { override: true }', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const teardown = registerPreset({
      attribute: 'fx-submit',
      connect: () => true,
    });

    expect(warnSpy).toHaveBeenCalled();
    expect(teardown).toBeDefined();

    teardown();
    warnSpy.mockRestore();
  });

  it('3. P0-7: Status targeting routes hx-status:* through generated attribute registry', () => {
    Flux.dispose();
    Flux.configure();

    const el = makeEl('<button fx-get="/test" fx-on-422="#err">Send</button>');
    document.body.appendChild(el);

    wireStatusTargeting(el);
    expect(el.getAttribute('hx-status:422')).toBe('{"target":"#err"}');
    expect(getGeneratedAttributes(el).has('hx-status:422')).toBe(true);

    Flux.dispose({ removeGeneratedAttributes: true });
    expect(el.hasAttribute('hx-status:422')).toBe(false);
  });

  it('4. P1-12: Removes generated hx-* when source fx-* attribute is removed', () => {
    const el = makeEl('<button fx-get="/u">Click</button>');
    expandElement(el);
    expect(el.getAttribute('hx-get')).toBe('/u');

    el.removeAttribute('fx-get');
    expandElement(el);
    expect(el.hasAttribute('hx-get')).toBe(false);
  });

  it('5. P1-18: Flux.use() auto-processes active DOM when runtime is already started', () => {
    Flux.dispose();
    Flux.configure();

    const customConnect = vi.fn((el: Element, val: string) => {
      el.setAttribute('hx-get', val);
      return true;
    });

    const el = makeEl('<div fx-autoprocess="/data"></div>');
    document.body.appendChild(el);

    Flux.use({
      name: 'autoprocess-plugin',
      setup(api) {
        api.registerPreset('fx-autoprocess', (el, val) => customConnect(el, val));
      },
    });

    expect(customConnect).toHaveBeenCalled();
    expect(el.getAttribute('hx-get')).toBe('/data');
  });

  it('6. P2-30: Flux.doctor inspects preset elements correctly using [attribute] selectors', () => {
    const el = makeEl('<form fx-submit="/save"></form>');
    document.body.appendChild(el);

    const doc = doctor(document.body);
    expect(doc.elementsInspected).toBeGreaterThan(0);
  });
});
