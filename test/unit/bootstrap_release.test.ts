import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import { readFluxMetaConfig, duplicatePolicy } from '../../src/core/startup.js';
import { registerAlpine, resetAlpineForTests } from '../../src/adapters/alpine.js';
import { installFeedback, resetFeedbackForTests } from '../../src/core/feedback.js';

describe('autoStart: false & Meta Config', () => {
  it('parses autoStart: false correctly from meta tag', () => {
    const meta = document.createElement('meta');
    meta.name = 'flux-config';
    meta.content = JSON.stringify({ autoStart: false, dependencies: { duplicatePolicy: 'error' } });
    document.head.appendChild(meta);

    const cfg = readFluxMetaConfig();
    expect(cfg.autoStart).toBe(false);
    expect(cfg.duplicatePolicy).toBe('error');

    meta.remove();
  });
});

describe('duplicate dependency policy', () => {
  it('throws error when policy is error and instance exists', () => {
    expect(() => duplicatePolicy('htmx', {}, 'error')).toThrow(/Existing htmx instance detected/);
  });

  it('warns when policy is warn and instance exists', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(duplicatePolicy('alpine', {}, 'warn')).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('Alpine adapter cleanup and double init protection', () => {
  it('returns a cleanup function that unregisters after:process listener', () => {
    resetAlpineForTests();
    const mockAlpine = {
      store: vi.fn(),
      initTree: vi.fn(),
      start: vi.fn(),
    };

    const cleanup = registerAlpine(mockAlpine as any);
    expect(typeof cleanup).toBe('function');

    const node = document.createElement('div');
    document.body.appendChild(node);
    node.dispatchEvent(new CustomEvent('htmx:after:process', { bubbles: true }));

    expect(mockAlpine.initTree).toHaveBeenCalledTimes(1);

    // Second after:process on same node should be skipped by double-init guard
    node.dispatchEvent(new CustomEvent('htmx:after:process', { bubbles: true }));
    expect(mockAlpine.initTree).toHaveBeenCalledTimes(1);

    cleanup();
  });
});

describe('Toast Store Push on fx-success / fx-error', () => {
  it('pushes to Alpine fluxToast store when feedback is announced', () => {
    resetFeedbackForTests();
    const toastStore = {
      success: vi.fn(),
      error: vi.fn(),
    };
    (window as any).Alpine = {
      store: (name: string) => (name === 'fluxToast' ? toastStore : undefined),
    };

    installFeedback();

    const source = document.createElement('div');
    source.setAttribute('fx-success', 'User saved successfully');
    document.body.appendChild(source);

    source.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: source,
            response: { status: 200 },
            successful: true,
          },
        },
      }),
    );

    expect(toastStore.success).toHaveBeenCalledWith('User saved successfully');
    delete (window as any).Alpine;
    resetFeedbackForTests();
  });
});
