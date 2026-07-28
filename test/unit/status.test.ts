import { describe, expect, it } from 'vitest';
import { collectRules } from '../../src/core/status.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('collectRules (fx-on-<code>)', () => {
  it('collects every fx-on-* attribute', () => {
    const el = makeEl(
      '<form fx-submit="/u" fx-on-422="#errors" fx-on-409="#conflict" fx-on-500="#server"></form>',
    );
    const rules = collectRules(el);
    expect(rules.get(422)).toBe('#errors');
    expect(rules.get(409)).toBe('#conflict');
    expect(rules.get(500)).toBe('#server');
  });

  it('ignores non-numeric codes and empty values', () => {
    const el = makeEl('<form fx-on-422="#errors" fx-on-abc="#x" fx-on-500=""></form>');
    const rules = collectRules(el);
    expect(rules.size).toBe(1);
    expect(rules.has(422)).toBe(true);
  });

  it('returns empty for an element with no fx-on-*', () => {
    expect(collectRules(makeEl('<form fx-submit="/u"></form>')).size).toBe(0);
  });
});
