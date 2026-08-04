import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { queryOne, queryMany, safeQuerySelector } from '../../src/core/selectors.js';
import {
  setGeneratedAttribute,
  getGeneratedAttributes,
  removeGeneratedAttributes,
} from '../../src/core/generated-attributes.js';
import { getRequestContext } from '../../src/core/events.js';
import { setRequestState, setLoadingState } from '../../src/core/request-state.js';
import { ControllerRegistry } from '../../src/core/controllers.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('Infrastructure Refactoring & Diagnostics Test Suite', () => {
  it('1. Selector Utility: queryOne and queryMany handle invalid selector syntax without throwing', () => {
    expect(queryOne('[invalid')).toBeNull();
    expect(queryMany('[invalid')).toEqual([]);
    expect(safeQuerySelector('[invalid')).toBeNull();
  });

  it('2. Generated Attribute Registry: preserves user-written hx-* attributes and removes owned attributes', () => {
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

  it('3. HTMX Event Detail Adapter: standardizes request details across event formats', () => {
    const customEvt = new CustomEvent('htmx:after:request', {
      detail: {
        ctx: {
          sourceElement: document.body,
          response: { status: 200, text: 'OK' },
          successful: true,
        },
      },
    });

    const ctx = getRequestContext(customEvt);
    expect(ctx.source).toBe(document.body);
    expect(ctx.status).toBe(200);
    expect(ctx.text).toBe('OK');
    expect(ctx.successful).toBe(true);
  });

  it('4. Request State Machine: cleanly sets state attributes without state pollution', () => {
    const el = makeEl('<div>Item</div>');

    setLoadingState(el, true);
    expect(el.getAttribute('data-flux-loading')).toBe('1');
    expect(el.hasAttribute('data-flux-error')).toBe(false);

    setRequestState(el, 'http-error', 422);
    expect(el.getAttribute('data-flux-error')).toBe('1');
    expect(el.getAttribute('data-flux-http-error')).toBe('422');
    expect(el.getAttribute('data-flux-loading')).toBe('1'); // Loading state preserved for concurrent requests

    setLoadingState(el, false);
    expect(el.hasAttribute('data-flux-loading')).toBe(false);

    setRequestState(el, 'idle');
    expect(el.hasAttribute('data-flux-error')).toBe(false);
  });

  it('5. ControllerRegistry: handles connected teardowns per type and element', () => {
    const registry = new ControllerRegistry();
    const el = makeEl('<button>Click</button>');
    const cleanupSpy = vi.fn();

    registry.connect('test', el, () => cleanupSpy);
    expect(registry.has('test', el)).toBe(true);

    registry.disposeAll();
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('6. Diagnostics API: Flux.inspect and Flux.doctor report element/runtime health', () => {
    const el = makeEl('<button fx-get="/test" fx-target="#res">Fetch</button>');
    document.body.appendChild(el);
    Flux.process(el);

    const insp = Flux.inspect(el);
    expect(insp.element).toBe(el);

    const report = Flux.doctor(document.body);
    expect(report.fluxVersion).toBe('1.3.1');
    expect(typeof report.elementsInspected).toBe('number');
  });

  it('7. Public Plugin System: Flux.use registers custom plugins and presets', () => {
    const pluginCleanup = vi.fn();
    Flux.use({
      name: 'test-plugin',
      setup(api) {
        expect(api.version).toBe('1.3.1');
        return pluginCleanup;
      },
    });

    Flux.dispose();
    expect(pluginCleanup).toHaveBeenCalled();
  });
});
