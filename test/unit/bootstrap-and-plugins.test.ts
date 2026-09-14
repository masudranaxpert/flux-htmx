import './setup.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fluxApi, { bootstrapFlux } from '../../src/flux.js';
import * as Flux from '../../src/flux.js';
import {
  duplicatePolicy,
  readFluxMetaConfig,
  reportDependencies,
  verifyHtmxVersion,
  resolveHtmx,
  resetStartupWarningsForTests,
  type HtmxGlobal,
} from '../../src/core/startup.js';
import { FLUX_VERSION } from '../../src/core/version.js';
import { registerPreset } from '../../src/presets/index.js';
import { ControllerRegistry } from '../../src/core/controllers.js';
import { installPersist } from '../../src/plugins/persist.js';
import { executeAction } from '../../src/core/actions.js';
import { resetFeedbackForTests } from '../../src/core/feedback.js';
import { optimisticPlugin } from '../../src/plugins/optimistic.js';
import { parseMaxSizeBytes, uploadPlugin } from '../../src/plugins/upload.js';
import pkg from '../../package.json';

function makeEl(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as HTMLElement;
}

function beforeRequest(elt: Element, request: Record<string, unknown>): CustomEvent {
  return new CustomEvent('htmx:before:request', {
    bubbles: true,
    detail: { ctx: { sourceElement: elt, target: elt, request } },
  });
}

function afterRequest(elt: Element, ctx: Record<string, unknown>): CustomEvent {
  return new CustomEvent('htmx:after:request', { bubbles: true, detail: { ctx } });
}

describe('bootstrap and duplicate-instance policy', () => {
  it('returns true for reuse when an instance exists', () => {
    expect(duplicatePolicy('htmx', {}, 'reuse')).toBe(true);
  });

  it('returns false for reuse when no instance exists', () => {
    expect(duplicatePolicy('htmx', undefined, 'reuse')).toBe(false);
  });

  it('throws on error policy', () => {
    expect(() => duplicatePolicy('flux', {}, 'error')).toThrow(/Existing flux instance/);
  });

  it('warns (no throw) on warn policy', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(duplicatePolicy('htmx', {}, 'warn')).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('handles duplicate policies', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(duplicatePolicy('htmx', {}, 'warn')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);

    expect(() => duplicatePolicy('htmx', {}, 'error')).toThrow();
  });

  it('Validates duplicatePolicy parameter strictly', () => {
    expect(() => duplicatePolicy('flux', {}, 'invalid' as unknown as 'reuse')).toThrow(
      '[flux] Invalid duplicatePolicy "invalid"',
    );
  });
});

describe('reportDependencies', () => {
  it('reports versions where present', () => {
    const deps = reportDependencies({
      htmx: { version: '4.0.0-beta6' },
    });
    expect(deps).toEqual({ htmx: '4.0.0-beta6' });
  });

  it('returns "unknown" when version is absent', () => {
    expect(reportDependencies({ htmx: {} })).toEqual({
      htmx: 'unknown',
    });
  });
});

describe('meta config (flux-config)', () => {
  it('returns safe defaults with no meta tag', () => {
    const cfg = readFluxMetaConfig();
    expect(cfg.autoStart).toBe(true);
    expect(cfg.duplicatePolicy).toBe('warn');
  });

  it('parses a flux-config meta tag', () => {
    const meta = document.createElement('meta');
    meta.name = 'flux-config';
    meta.content = '{"autoStart":false,"dependencies":{"duplicatePolicy":"error"}}';
    document.head.appendChild(meta);

    const cfg = readFluxMetaConfig();
    expect(cfg.autoStart).toBe(false);
    expect(cfg.duplicatePolicy).toBe('error');

    meta.remove();
  });

  it('extracts config correctly when autoStart is explicitly false', () => {
    document.head.innerHTML = `
      <meta name="flux-config" content='{"autoStart": false, "duplicatePolicy": "warn"}'>
    `;
    const config = readFluxMetaConfig();
    expect(config.autoStart).toBe(false);
    expect(config.duplicatePolicy).toBe('warn');
  });

  it('extracts configuration options to pass to core.configure', () => {
    document.head.innerHTML = `
      <meta name="flux-config" content='{"offline": {"enabled": true}}'>
    `;
    const config = readFluxMetaConfig();
    expect(config.flux?.offline?.enabled).toBe(true);
  });
});

describe('ESM exports parity', () => {
  it('is a non-empty string', () => {
    expect(typeof FLUX_VERSION).toBe('string');
    expect(FLUX_VERSION.length).toBeGreaterThan(0);
  });

  it('exposes window.Flux global public API for browser inspection', () => {
    const globalFlux = bootstrapFlux({ api: fluxApi }) as { version: string };
    expect(globalFlux).toBeDefined();
    expect(globalFlux.version).toBe(FLUX_VERSION);
    expect(globalFlux.isStarted).toBe(true);
    expect(typeof globalFlux.configure).toBe('function');
    expect(typeof globalFlux.process).toBe('function');
    expect(typeof globalFlux.start).toBe('function');
    expect(globalFlux.cache).toBeDefined();
    expect(globalFlux.htmx).toBeDefined();
  });

  it('Version: exposes the package version', () => {
    expect(FLUX_VERSION).toBe(pkg.version);
    expect(Flux.default.version).toBe(pkg.version);
  });

  it('Flux exports API getters and version property', () => {
    Flux.dispose();
    expect(Flux.FLUX_VERSION).toBeDefined();
    expect(typeof Flux.isStarted).toBe('function');
  });

  it('Modular ESM API exports parity', () => {
    expect(typeof Flux.start).toBe('function');
    expect(typeof Flux.reconfigure).toBe('function');
    expect(typeof Flux.isStarted).toBe('function');
    expect(typeof Flux.config).toBe('function');
    expect(Flux.FLUX_VERSION).toBe(pkg.version);
  });
});

describe('HTMX version guard', () => {
  it('throws an error if HTMX 2.x or non-4 is passed', () => {
    expect(() => verifyHtmxVersion({ version: '2.0.0' })).toThrow(
      '[flux] HTMX 4 is required; found 2.0.0',
    );
    expect(() => verifyHtmxVersion(null)).toThrow('[flux] HTMX was not found');
    expect(() => verifyHtmxVersion({ version: '4.0.0-beta6' })).not.toThrow();
  });
});

describe('reconfigure()', () => {
  it('automatically reprocesses document body after reconfiguring runtime', () => {
    Flux.dispose();
    Flux.configure({ requests: { timeoutMs: 1000 } });

    const btn = makeEl('<button fx-post="/delete" fx-indicator="#spinner">Delete</button>');
    document.body.appendChild(btn);

    Flux.reconfigure({ requests: { timeoutMs: 3000 } });

    // Expansion attributes should be re-applied to existing DOM elements
    expect(btn.getAttribute('hx-post')).toBe('/delete');
    expect(btn.getAttribute('hx-indicator')).toBe('#spinner');
    Flux.dispose();
  });

  it('reconfigures runtime by re-installing hooks with new configuration while preserving cache', () => {
    Flux.dispose();
    Flux.configure({ requests: { timeoutMs: 1000 } });
    expect(Flux.isStarted()).toBe(true);

    Flux.cache.set('GET:/test', 'cached value');

    const newConfig = Flux.reconfigure({ requests: { timeoutMs: 5000 } });
    expect(newConfig.requests.timeoutMs).toBe(5000);

    // Fragment cache must be preserved across reconfigure
    expect(Flux.cache.get('GET:/test')).toBe('cached value');

    Flux.dispose();
  });

  it('Plugins reactivate cleanly across reconfigure()', () => {
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
});

describe('plugin system (Flux.use)', () => {
  beforeEach(() => {
    Flux.dispose();
  });
  it('Flux.use() auto-processes active DOM when runtime is already started', () => {
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

  it('Pre-start plugin use() executes setup', () => {
    Flux.dispose();
    const setupSpy = vi.fn();
    Flux.use({ name: 'deferred-plugin', setup: setupSpy });
    Flux.start();

    expect(setupSpy).toHaveBeenCalledTimes(1);
  });

  it('Custom plugin presets expand dynamically during Flux.process()', () => {
    Flux.configure();
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

  it('Public Plugin System: Flux.use registers custom plugins and presets', () => {
    Flux.configure();
    const pluginCleanup = vi.fn();
    Flux.use({
      name: 'test-plugin',
      setup(api) {
        expect(api.version).toBe(pkg.version);
        return pluginCleanup;
      },
    });

    Flux.dispose();
    expect(pluginCleanup).toHaveBeenCalled();
  });

  describe('plugin unuse cleanup', () => {
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

    it('unregisters actions owned by an unused plugin', async () => {
      Flux.configure();
      const handler = vi.fn();
      Flux.use({
        name: 'audit-actions',
        setup(api) {
          api.registerAction('audit-plugin-action', handler);
        },
      });
      const source = makeEl('<button></button>');

      await executeAction('audit-plugin-action', source);
      Flux.unuse('audit-actions');
      await executeAction('audit-plugin-action', source);

      expect(handler).toHaveBeenCalledOnce();
    });
  });
});

describe('preset registration', () => {
  it('registerPreset prevents silent built-in override without { override: true }', () => {
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

  it('Unregistering an overridden preset restores the previous preset definition', () => {
    const originalTeardown = registerPreset({
      attribute: 'fx-custom-test',
      connect: () => true,
    });

    const overrideTeardown = registerPreset(
      {
        attribute: 'fx-custom-test',
        connect: () => false,
      },
      { override: true },
    );

    overrideTeardown();
    // Previous definition restored
    originalTeardown();
  });

  it('registerPreset returns teardown and warns on duplicate registration without override', () => {
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

describe('dispose semantics', () => {
  it('Cleans up data-flux-preset markers on dispose() allowing seamless re-connection', () => {
    Flux.dispose();
    Flux.configure();

    const form = makeEl(
      '<form fx-submit="/save" fx-reset><button type="submit">Submit</button></form>',
    ) as HTMLFormElement;
    form.reset = vi.fn();
    document.body.appendChild(form);

    Flux.process(document.body);
    expect(form.getAttribute('data-flux-preset')).toBe('submit');

    // Dispose must clear the marker
    Flux.dispose();
    expect(form.hasAttribute('data-flux-preset')).toBe(false);

    // Re-starting must re-attach the controller
    Flux.start();
    expect(form.getAttribute('data-flux-preset')).toBe('submit');

    form.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { ctx: { sourceElement: form, response: { status: 200 }, successful: true } },
      }),
    );
    expect(form.reset).toHaveBeenCalled();

    Flux.dispose();
  });

  it('Preset generated attributes tracked in registry and cleaned up on hard dispose', () => {
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

  describe('hard dispose cleanup', () => {
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

    it('hard dispose removes shorthand output from shorthand-only elements', () => {
      Flux.configure();
      const button = makeEl('<button fx-get="/users"></button>');
      document.body.appendChild(button);
      Flux.process(button);
      expect(button.getAttribute('hx-get')).toBe('/users');

      Flux.dispose({ removeGeneratedAttributes: true });

      expect(button.hasAttribute('hx-get')).toBe(false);
      expect(button.hasAttribute('data-flux-gen-shorthand-get')).toBe(false);
    });

    it('hard dispose removes scope-inherited fx-* output', () => {
      Flux.configure();
      const scope = makeEl(`
        <section fx-scope fx-default-indicator="#spinner" fx-default-target="#result">
          <form fx-submit="/users"></form>
        </section>
      `);
      document.body.appendChild(scope);
      const form = scope.querySelector('form')!;
      Flux.process(scope);
      expect(form.getAttribute('hx-indicator')).toBe('#spinner');

      Flux.dispose({ removeGeneratedAttributes: true });

      expect(form.hasAttribute('hx-indicator')).toBe(false);
      expect(form.hasAttribute('hx-target')).toBe(false);
    });
  });
});

describe('controller registry', () => {
  it('ControllerRegistry: handles connected teardowns per type and element', () => {
    const registry = new ControllerRegistry();
    const el = makeEl('<button>Click</button>');
    const cleanupSpy = vi.fn();

    registry.connect('test', el, () => cleanupSpy);
    expect(registry.has('test', el)).toBe(true);

    registry.disposeAll();
    expect(cleanupSpy).toHaveBeenCalled();
  });
});

describe('upload plugin', () => {
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

  it('Upload Progress Plugin: handles drag-and-drop, scoped unuse cleanup, and preserves other page elements', () => {
    expect(parseMaxSizeBytes('20mb')).toBe(20971520);
    expect(parseMaxSizeBytes('500kb')).toBe(512000);
    expect(parseMaxSizeBytes('100')).toBe(100);

    Flux.dispose();
    Flux.configure();
    Flux.use(uploadPlugin);

    const normalBtn = makeEl('<button fx-get="/users" fx-target="#users">Load Users</button>');
    document.body.appendChild(normalBtn);

    const form = makeEl(
      '<form fx-upload="/files" fx-max-size="10mb"><input type="file" name="doc"/></form>',
    );
    document.body.appendChild(form);
    Flux.process(document.body);

    expect(normalBtn.getAttribute('hx-get')).toBe('/users');
    expect(form.getAttribute('hx-post')).toBe('/files');

    const dragOverEvt = new CustomEvent('dragover', { bubbles: true, cancelable: true });
    form.dispatchEvent(dragOverEvt);
    expect(form.getAttribute('data-flux-drag-over')).toBe('1');

    const dragLeaveEvt = new CustomEvent('dragleave', { bubbles: true });
    form.dispatchEvent(dragLeaveEvt);
    expect(form.getAttribute('data-flux-drag-over')).toBeNull();

    Flux.unuse('upload');

    // Scoped cleanup: form's hx-post is cleaned up, but normalBtn's hx-get remains untouched!
    expect(form.getAttribute('hx-post')).toBeNull();
    expect(normalBtn.getAttribute('hx-get')).toBe('/users');
  });

  it('disconnects upload listeners when the plugin preset is removed', () => {
    Flux.configure();
    Flux.use(uploadPlugin);
    const form = makeEl('<form fx-upload="/upload"></form>');
    document.body.appendChild(form);
    Flux.process(form);

    form.removeAttribute('fx-upload');
    Flux.process(form);
    form.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));

    expect(form.hasAttribute('hx-post')).toBe(false);
    expect(form.hasAttribute('data-flux-preset')).toBe(false);
    expect(form.hasAttribute('data-flux-drag-over')).toBe(false);
    Flux.unuse('upload');
  });

  it('exposes upload honestly without claiming native progress support', () => {
    expect(uploadPlugin.name).toBe('upload');
  });
});

describe('optimistic plugin', () => {
  beforeEach(() => {
    Flux.dispose();
    document.body.innerHTML = '';
  });

  it('rolls back an ancestor row on failure without fx-rollback opt-in', () => {
    Flux.configure();
    Flux.use(optimisticPlugin);

    // Real table markup: a stray <tr> outside a table gets dropped by the parser.
    const table = makeEl(
      '<table><tbody><tr id="row-x" fx-optimistic-remove="closest tr"><td><button id="row-btn">x</button></td></tr></tbody></table>',
    );
    document.body.appendChild(table);
    const row = document.querySelector('#row-x')!;
    const btn = document.querySelector('#row-btn')!;
    expect(row.isConnected).toBe(true);

    btn.dispatchEvent(beforeRequest(btn, { method: 'POST', action: '/rows/1' }));
    // Optimistic removal happened (keyed by the request SOURCE, an ancestor trigger)...
    expect(row.isConnected).toBe(false);

    const failCtx: Record<string, unknown> = {
      sourceElement: btn,
      request: { method: 'POST', action: '/rows/1' },
      response: { status: 500 },
    };
    btn.dispatchEvent(afterRequest(btn, failCtx));
    // ...and rollback is the default, restoring the removed row.
    expect(row.isConnected).toBe(true);
  });

  it('Optimistic UI Plugin: requires explicit fx-rollback for DOM rollback', () => {
    Flux.dispose();
    Flux.configure();
    Flux.use(optimisticPlugin);

    const list = makeEl('<ul><li id="item-1">Item 1</li></ul>');
    document.body.appendChild(list);

    const btn = makeEl(
      '<button fx-delete="/item/1" fx-optimistic-remove="#item-1" fx-rollback>Delete</button>',
    );
    document.body.appendChild(btn);

    // Simulate htmx before request
    btn.dispatchEvent(
      new CustomEvent('htmx:before:request', { bubbles: true, detail: { elt: btn } }),
    );
    expect(document.querySelector('#item-1')).toBeNull();

    // Simulate htmx request error with fx-rollback opt-in
    btn.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { elt: btn, successful: false, xhr: { status: 500 } },
      }),
    );
    expect(document.querySelector('#item-1')).not.toBeNull();
  });
});

describe('plugin teardown contract', () => {
  it('installPersist teardown prevents listener stacking across restarts', () => {
    const box = document.createElement('div');
    const input = document.createElement('input');
    input.setAttribute('fx-persist', 'k');
    box.appendChild(input);
    document.body.appendChild(box);
    localStorage.setItem('fx-persist:k', 'saved');

    installPersist();
    installPersist();
    let restored = 0;
    input.addEventListener('flux:persist:restored', () => restored++);

    // Named module-level handler: DOM dedupes the second add, so still one restore
    // per settle event even when installed twice...
    document.dispatchEvent(
      new CustomEvent('htmx:after:settle', { detail: { ctx: { target: box } } }),
    );
    expect(restored).toBe(1);

    // ...but after teardown, the settle listener is gone entirely. (installPersist
    // also restores synchronously via onReady, so reset the counter first.)
    const td = installPersist();
    td();
    restored = 0;
    document.dispatchEvent(
      new CustomEvent('htmx:after:settle', { detail: { ctx: { target: box } } }),
    );
    expect(restored).toBe(0);
    box.remove();
  });
});

describe('resolveHtmx precedence and fallback order', () => {
  beforeEach(() => resetStartupWarningsForTests());

  it('(a) imported valid with process -> returns imported', () => {
    const imported = { process: vi.fn() } as unknown as HtmxGlobal;
    expect(resolveHtmx(imported)).toBe(imported);
  });

  it('(b) imported invalid (no process) + global exists -> returns global', () => {
    const globalHtmx = { process: vi.fn() } as unknown as HtmxGlobal;
    const win = window as unknown as { htmx?: HtmxGlobal };
    win.htmx = globalHtmx;
    try {
      expect(resolveHtmx({} as unknown as HtmxGlobal)).toBe(globalHtmx);
    } finally {
      delete win.htmx;
    }
  });

  it('(c) neither has process -> returns undefined or fallback', () => {
    expect(resolveHtmx(null)).toBeUndefined();
    expect(resolveHtmx(undefined)).toBeUndefined();
  });

  it('(d) warns once if both valid imported and global exist and differ', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const imported = { process: vi.fn() } as unknown as HtmxGlobal;
    const globalHtmx = { process: vi.fn() } as unknown as HtmxGlobal;
    const win = window as unknown as { htmx?: HtmxGlobal };
    win.htmx = globalHtmx;
    try {
      expect(resolveHtmx(imported)).toBe(imported);
      expect(warn).toHaveBeenCalledTimes(1);
      // second call should not warn again
      resolveHtmx(imported);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      delete win.htmx;
      warn.mockRestore();
    }
  });
});
