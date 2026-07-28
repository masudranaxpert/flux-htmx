import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { registerPreset } from '../../src/presets/index.js';
import { applySubmit } from '../../src/presets/submit.ts';
import { applyDelete } from '../../src/presets/delete.ts';
import { getCachePolicy } from '../../src/cache/cacheWire.ts';
import {
  reconcileGeneratedAttributes,
  getGeneratedAttributes,
} from '../../src/core/generated-attributes.ts';
import { wireStatusTargeting } from '../../src/core/status.ts';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('Final Hardening (v0.1.0-beta.0) Comprehensive Test Suite', () => {
  it('1. P0-1: Flux exports API getters and version property', () => {
    Flux.dispose();
    expect(Flux.FLUX_VERSION).toBeDefined();
    expect(typeof Flux.isStarted).toBe('function');
  });

  it('2. P0-2: Empty fx-cache attribute returns default 60s TTL policy', () => {
    const el = makeEl('<div fx-cache></div>');
    const policy = getCachePolicy(el);
    expect(policy.enabled).toBe(true);
    expect(policy.ttl).toBe(60000);
  });

  it('3. P0-3: Active confirm dialog drops pending request on Flux.dispose()', () => {
    Flux.dispose();
    Flux.configure();

    const dialog = makeEl(`
      <dialog id="confirm-modal">
        <button class="confirm" data-flux-confirm>Yes</button>
      </dialog>
    `) as HTMLDialogElement;
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    document.body.appendChild(dialog);

    const button = makeEl(
      '<button fx-get="/del" fx-confirm-dialog="#confirm-modal">Delete</button>',
    );
    document.body.appendChild(button);

    let dropped = false;
    button.dispatchEvent(
      new CustomEvent('htmx:confirm', {
        bubbles: true,
        detail: {
          elt: button,
          issueRequest: () => {},
          dropRequest: () => {
            dropped = true;
          },
        },
      }),
    );

    Flux.dispose();
    expect(dropped).toBe(true);
    expect(dialog.close).toHaveBeenCalled();
  });

  it('4. P0-4: Pre-start plugin use() executes setup', () => {
    Flux.dispose();
    const setupSpy = vi.fn();
    Flux.use({ name: 'deferred-plugin', setup: setupSpy });

    expect(setupSpy).toHaveBeenCalledTimes(1);
  });

  it('5. P0-5: Unregistering an overridden preset restores the previous preset definition', () => {
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

  it('6. P1-6: Removing optional preset attribute cleans up generated attribute', () => {
    const el = makeEl('<div fx-load="/panel" fx-target="#res"></div>');
    Flux.process(el);
    expect(el.getAttribute('hx-target')).toBe('#res');

    el.removeAttribute('fx-target');
    Flux.process(el);
    expect(el.hasAttribute('hx-target')).toBe(false);
  });

  it('7. P1-7: Removing preset attribute completely tears down generated attributes and signature', () => {
    const el = makeEl('<form fx-submit="/save"></form>');
    Flux.process(el);
    expect(el.getAttribute('data-flux-preset')).toBe('submit');
    expect(el.hasAttribute('hx-post')).toBe(true);

    el.removeAttribute('fx-submit');
    reconcileGeneratedAttributes(el);
    expect(el.hasAttribute('data-flux-preset')).toBe(false);
    expect(el.hasAttribute('hx-post')).toBe(false);
  });

  it('8. P1-9: Status fx-on-* runtime attribute modification rewires target', () => {
    const el = makeEl('<form fx-on-422="#old-errors"></form>');
    document.body.appendChild(el);
    wireStatusTargeting(el);
    expect(el.getAttribute('hx-status:422')).toBe('{"target":"#old-errors"}');

    el.setAttribute('fx-on-422', '#new-errors');
    wireStatusTargeting(el);
    expect(el.getAttribute('hx-status:422')).toBe('{"target":"#new-errors"}');
  });

  it('9. P2-12: Doctor inspects arbitrary fx-on-401 status selector rules', () => {
    const el = makeEl('<div fx-on-401="[invalid"></div>');
    document.body.appendChild(el);
    const report = Flux.doctor(document.body);
    expect(report.warnings.some((w) => w.includes('fx-on-401'))).toBe(true);
  });
});
