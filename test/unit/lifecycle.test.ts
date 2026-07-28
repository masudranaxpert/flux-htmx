import { describe, expect, it } from 'vitest';
import { expandPresets } from '../../src/core/lifecycle.js';

function makeRoot(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html.trim();
  return root;
}

describe('expandPresets', () => {
  it('expands fx-get on a descendant', () => {
    const root = makeRoot('<div><button fx-get="/u">x</button></div>');
    expect(expandPresets(root)).toBeGreaterThanOrEqual(1);
    expect(root.querySelector('button')!.getAttribute('hx-get')).toBe('/u');
  });

  it('expands an element that is the root itself', () => {
    const root = document.createElement('button');
    root.setAttribute('fx-get', '/u');
    expandPresets(root);
    expect(root.getAttribute('hx-get')).toBe('/u');
  });

  it('expands fx-search before generic so generic does not clobber the preset', () => {
    const root = makeRoot('<input fx-search="/q" fx-target="#r" fx-delay="300ms">');
    expandPresets(root);
    const input = root.querySelector('input')!;
    // Preset produced hx-get + hx-trigger; generic fx-target becomes hx-target.
    expect(input.getAttribute('hx-get')).toBe('/q');
    expect(input.getAttribute('hx-trigger')).toContain('changed');
    expect(input.getAttribute('hx-target')).toBe('#r');
    // fx-* source attributes are preserved.
    expect(input.getAttribute('fx-search')).toBe('/q');
  });

  it('is idempotent on repeated calls', () => {
    const root = makeRoot('<button fx-get="/u" fx-target="#u">x</button>');
    expandPresets(root);
    const second = expandPresets(root);
    expect(second).toBe(0);
    expect(root.querySelector('button')!.getAttribute('hx-get')).toBe('/u');
  });

  it('leaves raw hx-* authoritative when mixed with fx-*', () => {
    const root = makeRoot('<button fx-get="/flux" hx-get="/raw">x</button>');
    expandPresets(root);
    expect(root.querySelector('button')!.getAttribute('hx-get')).toBe('/raw');
  });
});
