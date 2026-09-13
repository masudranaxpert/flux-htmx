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

  it('expands a verb and its indicator option together', () => {
    const el = makeEl(`<button fx-get="/u" fx-indicator="#spinner">x</button>`);
    expect(expandElement(el)).toBe(2);
    expect(el.getAttribute('hx-get')).toBe('/u');
    expect(el.getAttribute('hx-indicator')).toBe('#spinner');
  });

  // 2.0: pure option aliases were removed. Users configure requests with raw hx-*.
  it.each(['target', 'swap', 'trigger', 'select', 'sync', 'vals', 'headers', 'confirm', 'boost'])(
    'no longer expands fx-%s',
    (option) => {
      const el = makeEl(`<div fx-${option}="v">x</div>`);
      expect(expandElement(el)).toBe(0);
      expect(el.hasAttribute(`hx-${option}`)).toBe(false);
      expect(hasFluxAttributes(el)).toBe(false);
    },
  );

  it('still expands fx-morph into hx-swap', () => {
    const el = makeEl(`<button fx-get="/u" fx-morph="outer">x</button>`);
    expandElement(el);
    expect(el.getAttribute('hx-swap')).toBe('outerMorph');
  });

  it('still expands fx-history into hx-push-url', () => {
    const el = makeEl(`<button fx-get="/u" fx-history="true">x</button>`);
    expandElement(el);
    expect(el.getAttribute('hx-push-url')).toBe('true');
  });
});

describe('expandElement — raw-wins precedence', () => {
  it('does not overwrite an existing hx-get', () => {
    const el = makeEl(`<button fx-get="/flux" hx-get="/raw">x</button>`);
    expect(expandElement(el)).toBe(0);
    expect(el.getAttribute('hx-get')).toBe('/raw');
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
    const el = makeEl(`<button fx-get="/u" fx-indicator="#s">x</button>`);
    expandElement(el);
    expandElement(el);
    expandElement(el);
    expect(el.getAttribute('hx-get')).toBe('/u');
    expect(el.getAttribute('hx-indicator')).toBe('#s');
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
  it('true for fx-* verbs and remaining shorthands', () => {
    expect(hasFluxAttributes(makeEl('<button fx-get="/u">x</button>'))).toBe(true);
    expect(hasFluxAttributes(makeEl('<div fx-indicator="#s">x</div>'))).toBe(true);
    expect(hasFluxAttributes(makeEl('<div fx-history="true">x</div>'))).toBe(true);
  });

  it('false for raw hx-*, removed aliases, and plain elements', () => {
    expect(hasFluxAttributes(makeEl('<button hx-get="/u">x</button>'))).toBe(false);
    expect(hasFluxAttributes(makeEl('<div fx-target="#u">x</div>'))).toBe(false);
    expect(hasFluxAttributes(makeEl('<button>x</button>'))).toBe(false);
  });
});
