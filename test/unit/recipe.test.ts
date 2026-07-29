import './setup.js';
import { describe, it, expect, beforeEach } from 'vitest';
import * as Flux from '../../src/flux.js';

describe('Recipe System (fx-recipe)', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    document.body.innerHTML = '';
    Flux.configure();
  });

  it('applies a simple recipe configuration', () => {
    Flux.recipe('admin-form', {
      validate: true,
      toast: true,
      retry: 3,
      focusError: true,
    });

    const el = document.createElement('form');
    el.setAttribute('fx-recipe', 'admin-form');
    // Also test that it doesn't overwrite existing explicit fx-* attributes
    el.setAttribute('fx-retry', '1');

    document.body.appendChild(el);
    Flux.process(el);

    expect(el.hasAttribute('fx-validate')).toBe(true);
    expect(el.hasAttribute('fx-toast')).toBe(true);
    // Should convert camelCase to kebab-case
    expect(el.hasAttribute('fx-focus-error')).toBe(true);

    // Explicit attribute should NOT be overwritten
    expect(el.getAttribute('fx-retry')).toBe('1');
  });

  it('skips false boolean flags', () => {
    Flux.recipe('no-toast', {
      toast: false,
      validate: true,
    });

    const el = document.createElement('form');
    el.setAttribute('fx-recipe', 'no-toast');
    document.body.appendChild(el);
    Flux.process(el);

    expect(el.hasAttribute('fx-validate')).toBe(true);
    expect(el.hasAttribute('fx-toast')).toBe(false);
  });
});
