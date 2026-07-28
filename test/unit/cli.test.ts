import { describe, expect, it } from 'vitest';
import { inspectHtml, parseArgs } from '../../src/cli/commands.js';

describe('inspectHtml', () => {
  it('expands generic fx-* verbs', () => {
    const lines = inspectHtml('<button fx-get="/users" fx-target="#u">x</button>');
    expect(lines).toContain('fx-get="/users" → hx-get="/users"');
    expect(lines).toContain('fx-target="#u" → hx-target="#u"');
  });

  it('expands fx-search into the multi-attribute preset', () => {
    const lines = inspectHtml('<input fx-search="/q" fx-delay="300ms">');
    expect(lines).toContain('fx-search="/q"');
    expect(lines).toContain('  → hx-get="/q"');
    expect(lines).toContain('  → hx-trigger="input changed delay:300ms"');
    expect(lines).toContain('  → hx-sync="this:replace"');
  });

  it('uses 300ms default delay when fx-delay is absent', () => {
    const lines = inspectHtml('<input fx-search="/q">');
    expect(lines).toContain('  → hx-trigger="input changed delay:300ms"');
  });

  it('returns empty for HTML with no flux attributes', () => {
    expect(inspectHtml('<button hx-get="/u">x</button>')).toEqual([]);
  });
});

describe('parseArgs', () => {
  it('splits command, positional, and flags', () => {
    expect(parseArgs(['add', 'dialog', '--dry-run'])).toEqual({
      command: 'add',
      positional: ['dialog'],
      options: { dryRun: true },
    });
  });

  it('defaults to empty command and dryRun false', () => {
    expect(parseArgs([])).toEqual({ command: '', positional: [], options: { dryRun: false } });
  });
});
