import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import {
  setGeneratedAttribute,
  getGeneratedAttributes,
} from '../../src/core/generated-attributes.js';
import { registerPreset } from '../../src/presets/index.js';
import { setRequestState, setLoadingState } from '../../src/core/request-state.js';
import { inspectElement, doctor } from '../../src/diagnostics/doctor.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('Refactoring Hardening Test Suite', () => {
  it('1. Custom plugin presets expand dynamically during Flux.process()', () => {
    const customConnect = vi.fn((el: Element, val: string) => {
      el.setAttribute('hx-get', val);
      return true;
    });

    Flux.use({
      name: 'custom-pagination-plugin',
      setup(api) {
        api.registerPreset('fx-pagination', (el, val) => customConnect(el, val));
      },
    });

    const el = makeEl('<div fx-pagination="/items?page=2"></div>');
    document.body.appendChild(el);

    Flux.process(el);

    expect(customConnect).toHaveBeenCalled();
    expect(el.getAttribute('hx-get')).toBe('/items?page=2');
  });

  it('2. Concurrent loading state isolation: setOutcomeState does not remove data-flux-loading', () => {
    const el = makeEl('<div>Control</div>');

    setLoadingState(el, true);
    expect(el.getAttribute('data-flux-loading')).toBe('1');

    setRequestState(el, 'success');
    expect(el.getAttribute('data-flux-success')).toBe('1');
    expect(el.getAttribute('data-flux-loading')).toBe('1'); // Loading state preserved for concurrent requests!

    setLoadingState(el, false);
    expect(el.hasAttribute('data-flux-loading')).toBe(false);
  });

  it('3. User attribute takeover detection: surrenders ownership when user mutates hx-* attribute', () => {
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

  it('4. Preset generated attributes tracked in registry and cleaned up on hard dispose', () => {
    Flux.dispose();
    Flux.configure();

    const form = makeEl(
      '<form fx-submit="/save" fx-confirm="Sure?"><button type="submit">Send</button></form>',
    );
    document.body.appendChild(form);

    Flux.process(form);
    expect(form.getAttribute('hx-post')).toBe('/save');

    // Hard dispose removes all generated attributes
    Flux.dispose({ removeGeneratedAttributes: true });
    expect(form.hasAttribute('hx-post')).toBe(false);
    expect(form.hasAttribute('hx-confirm')).toBe(false);
  });

  it('5. Plugins reactivate cleanly across reconfigure()', () => {
    const setupSpy = vi.fn();
    Flux.use({
      name: 'reactivate-test',
      setup: setupSpy,
    });
    Flux.start();

    expect(setupSpy).toHaveBeenCalledTimes(1);

    Flux.reconfigure({ requests: { timeoutMs: 2000 } });
    expect(setupSpy).toHaveBeenCalledTimes(2);

    Flux.dispose();
  });

  it('6. Diagnostics API handles null input and inspects all registered preset attributes', () => {
    const nullInsp = inspectElement(null);
    expect(nullInsp.element).toBeNull();
    expect(nullInsp.warnings).toContain('A valid Element is required for inspection');

    const form = makeEl('<form fx-submit="/save"></form>');
    const insp = inspectElement(form);
    expect(insp.presets).toContain('fx-submit');

    const doc = doctor(document.body);
    expect(doc.fluxVersion).toBe('1.2.3');
  });

  it('7. registerPreset returns teardown and warns on duplicate registration without override', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const teardown = registerPreset({
      attribute: 'fx-custom-test',
      connect: () => true,
    });

    registerPreset({
      attribute: 'fx-custom-test',
      connect: () => true,
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();

    teardown();
  });
});
