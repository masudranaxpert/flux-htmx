import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import { duplicatePolicy, reportDependencies, readFluxMetaConfig } from '../../src/core/startup.js';
import { FLUX_VERSION } from '../../src/core/version.js';
import '../../src/flux.js';

describe('duplicatePolicy', () => {
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
    expect(duplicatePolicy('alpine', {}, 'warn')).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('reportDependencies', () => {
  it('reports versions where present', () => {
    const deps = reportDependencies({
      htmx: { version: '4.0.0-beta6' },
      alpine: { version: '3.15.12' },
    });
    expect(deps).toEqual({ htmx: '4.0.0-beta6', alpine: '3.15.12' });
  });

  it('returns "unknown" when version is absent', () => {
    expect(reportDependencies({ htmx: {}, alpine: {} })).toEqual({
      htmx: 'unknown',
      alpine: 'unknown',
    });
  });
});

describe('readFluxMetaConfig', () => {
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
});

describe('FLUX_VERSION and Window.Flux public API', () => {
  it('is a non-empty string', () => {
    expect(typeof FLUX_VERSION).toBe('string');
    expect(FLUX_VERSION.length).toBeGreaterThan(0);
  });

  it('exposes window.Flux global public API for browser inspection', () => {
    const globalFlux = (window as any).Flux;
    expect(globalFlux).toBeDefined();
    expect(globalFlux.version).toBe(FLUX_VERSION);
    expect(globalFlux.isStarted).toBe(true);
    expect(typeof globalFlux.configure).toBe('function');
    expect(typeof globalFlux.process).toBe('function');
    expect(typeof globalFlux.start).toBe('function');
    expect(globalFlux.cache).toBeDefined();
    expect(globalFlux.htmx).toBeDefined();
  });
});
