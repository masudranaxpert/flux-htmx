import './setup.js';
import { describe, it, expect, beforeEach } from 'vitest';
import * as Flux from '../../src/flux.js';

describe('Scope System (fx-scope)', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    document.body.innerHTML = '';
    Flux.configure();
  });

  it('inherits defaults from nearest fx-scope', () => {
    const scope = document.createElement('section');
    scope.setAttribute('fx-scope', '');
    scope.setAttribute('fx-default-target', '#users-table');
    scope.setAttribute('fx-default-indicator', '#loading');
    scope.setAttribute('fx-default-error', 'Failed');
    document.body.appendChild(scope);

    const btn = document.createElement('button');
    btn.setAttribute('fx-get', '/users');
    scope.appendChild(btn);

    Flux.process(btn);

    // btn should have inherited properties converted from fx-default-* to fx-*
    // and then fx-* expanded to hx-*
    expect(btn.getAttribute('hx-target')).toBe('#users-table');
    expect(btn.getAttribute('hx-indicator')).toBe('#loading');
    expect(btn.getAttribute('fx-error')).toBe('Failed');
  });

  it('does not overwrite explicit element attributes', () => {
    const scope = document.createElement('section');
    scope.setAttribute('fx-scope', '');
    scope.setAttribute('fx-default-target', '#users-table');
    document.body.appendChild(scope);

    const btn = document.createElement('button');
    btn.setAttribute('fx-get', '/users');
    btn.setAttribute('fx-target', '#explicit-target');
    scope.appendChild(btn);

    Flux.process(btn);

    expect(btn.getAttribute('hx-target')).toBe('#explicit-target');
  });

  it('recipe attributes take precedence over scope defaults', () => {
    Flux.recipe('my-recipe', { target: '#recipe-target' });

    const scope = document.createElement('section');
    scope.setAttribute('fx-scope', '');
    scope.setAttribute('fx-default-target', '#scope-target');
    document.body.appendChild(scope);

    const btn = document.createElement('button');
    btn.setAttribute('fx-get', '/users');
    btn.setAttribute('fx-recipe', 'my-recipe');
    scope.appendChild(btn);

    Flux.process(btn);

    // Explicit element attribute (added by recipe) > Scope
    expect(btn.getAttribute('hx-target')).toBe('#recipe-target');
  });
});
