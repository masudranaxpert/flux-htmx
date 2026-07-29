import './setup.js';
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FLUX_VERSION } from '../../src/core/version.js';

describe('Built IIFE Bundle Safeguard Verification', () => {
  it('evaluates dist/flux.iife.js safely when window.htmx is absent and throws friendly HTMX missing error', () => {
    const bundlePath = path.resolve(process.cwd(), 'dist/flux.iife.js');
    expect(fs.existsSync(bundlePath)).toBe(true);

    const bundleCode = fs.readFileSync(bundlePath, 'utf8');

    // Temporarily remove window.htmx and globalThis.htmx
    const originalHtmx = (window as any).htmx;
    delete (window as any).htmx;
    delete (globalThis as any).htmx;

    try {
      expect(() => {
        // Execute IIFE script in window scope
        new Function('window', 'globalThis', 'document', bundleCode)(window, window, document);
      }).toThrow('[flux] HTMX was not found. Load HTMX 4 before Flux scripts.');
    } finally {
      if (originalHtmx) {
        (window as any).htmx = originalHtmx;
        (globalThis as any).htmx = originalHtmx;
      }
    }
  });

  it('exposes the package version on Flux.version', () => {
    expect(FLUX_VERSION).toBe('1.2.5');
  });
});
