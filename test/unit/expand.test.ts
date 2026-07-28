import { describe, expect, it } from 'vitest';
import { expandElement, hasFluxAttributes } from '../../src/core/expand.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('expandElement — verbs', () => {
  it.each(['get', 'post', 'put', 'patch', 'delete'])('expands fx-%s into hx-%s', (verb) => {
    const el = makeEl(`<button fx-${verb}="/users/1">x</button>`);
    expect(expandElement(el)).toBe(1);
    expect(el.getAttribute(`hx-${verb}`)).toBe('/users/1');
    expect(el.getAttribute(`fx-${verb}`)).toBe('/users/1');
  });

  it('expands a verb and its options together', () => {
    const el = makeEl(`<button fx-get="/u" fx-target="#u" fx-swap="outerHTML">x</button>`);
    expect(expandElement(el)).toBe(3);
    expect(el.getAttribute('hx-get')).toBe('/u');
    expect(el.getAttribute('hx-target')).toBe('#u');
    expect(el.getAttribute('hx-swap')).toBe('outerHTML');
  });
});

describe('expandElement — options', () => {
  it.each([
    'target',
    'swap',
    'trigger',
    'select',
    'sync',
    'indicator',
    'include',
    'vals',
    'headers',
    'confirm',
    'boost',
    'preload',
  ])('expands fx-%s into hx-%s', (option) => {
    const el = makeEl(`<div fx-${option}="v">x</div>`);
    expect(expandElement(el)).toBe(1);
    expect(el.getAttribute(`hx-${option}`)).toBe('v');
  });
});

describe('expandElement — raw-wins precedence', () => {
  it('does not overwrite an existing hx-get', () => {
    const el = makeEl(`<button fx-get="/flux" hx-get="/raw">x</button>`);
    expect(expandElement(el)).toBe(0);
    expect(el.getAttribute('hx-get')).toBe('/raw');
  });

  it('does not overwrite an existing hx-target but still expands other fx-*', () => {
    const el = makeEl(`<button fx-get="/u" fx-target="#flux" hx-target="#raw">x</button>`);
    expect(expandElement(el)).toBe(1);
    expect(el.getAttribute('hx-get')).toBe('/u');
    expect(el.getAttribute('hx-target')).toBe('#raw');
  });

  it('leaves a fully-raw hx-* element untouched', () => {
    const el = makeEl(`<button hx-get="/raw" hx-target="#raw">x</button>`);
    expect(expandElement(el)).toBe(0);
    expect(el.hasAttribute('fx-get')).toBe(false);
  });
});

describe('expandElement — idempotency', () => {
  it('second call writes nothing and keeps the value stable', () => {
    const el = makeEl(`<button fx-get="/u">x</button>`);
    expect(expandElement(el)).toBe(1);
    expect(expandElement(el)).toBe(0);
    expect(el.getAttribute('hx-get')).toBe('/u');
  });

  it('is idempotent across many calls', () => {
    const el = makeEl(`<button fx-get="/u" fx-target="#u">x</button>`);
    expandElement(el);
    expandElement(el);
    expandElement(el);
    expect(el.getAttribute('hx-get')).toBe('/u');
    expect(el.getAttribute('hx-target')).toBe('#u');
  });
});

describe('expandElement — edge cases', () => {
  it('returns 0 for an element with no flux attributes', () => {
    expect(expandElement(makeEl('<button>x</button>'))).toBe(0);
  });

  it('returns 0 for a non-Element', () => {
    expect(expandElement({} as Element)).toBe(0);
  });

  it('preserves empty-string values', () => {
    const el = makeEl(`<button fx-get="">x</button>`);
    expandElement(el);
    expect(el.getAttribute('hx-get')).toBe('');
  });
});

describe('hasFluxAttributes', () => {
  it('true for any fx-* verb or option', () => {
    expect(hasFluxAttributes(makeEl('<button fx-get="/u">x</button>'))).toBe(true);
    expect(hasFluxAttributes(makeEl('<div fx-target="#u">x</div>'))).toBe(true);
  });

  it('false for raw hx-* and plain elements', () => {
    expect(hasFluxAttributes(makeEl('<button hx-get="/u">x</button>'))).toBe(false);
    expect(hasFluxAttributes(makeEl('<button>x</button>'))).toBe(false);
  });
});
