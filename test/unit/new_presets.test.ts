import { describe, expect, it } from 'vitest';
import { applySubmit } from '../../src/presets/submit.js';
import { applyDelete } from '../../src/presets/delete.js';
import { applyAutosave } from '../../src/presets/autosave.js';
import { readCookie } from '../../src/core/csrf.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('fx-submit preset', () => {
  it('expands to hx-post by default', () => {
    const el = makeEl('<form fx-submit="/api/users"></form>');
    expect(applySubmit(el, { url: '/api/users' })).toBe(true);
    expect(el.getAttribute('hx-post')).toBe('/api/users');
  });

  it('respects fx-method option', () => {
    const el = makeEl('<form fx-submit="/api/users" fx-method="put"></form>');
    expect(applySubmit(el, { url: '/api/users' })).toBe(true);
    expect(el.getAttribute('hx-put')).toBe('/api/users');
  });
});

describe('high-level fx-delete preset', () => {
  it('expands to hx-delete and sets confirmation/invalidation attributes', () => {
    const el = makeEl(
      '<button fx-delete="/users/42" fx-confirm="Delete?" fx-success="Deleted" fx-invalidate="users:*"></button>',
    );
    expect(
      applyDelete(el, {
        url: '/users/42',
        confirm: 'Delete?',
        success: 'Deleted',
        invalidate: 'users:*',
      }),
    ).toBe(true);
    expect(el.getAttribute('hx-delete')).toBe('/users/42');
    expect(el.getAttribute('hx-confirm')).toBe('Delete?');
    expect(el.getAttribute('fx-success')).toBe('Deleted');
    expect(el.getAttribute('fx-invalidate')).toBe('users:*');
  });
});

describe('fx-autosave preset', () => {
  it('expands to hx-post with debounced change and input triggers', () => {
    const el = makeEl('<form fx-autosave="/api/save"></form>');
    expect(applyAutosave(el, { url: '/api/save' })).toBe(true);
    expect(el.getAttribute('hx-post')).toBe('/api/save');
    expect(el.getAttribute('hx-trigger')).toContain('input changed delay:500ms');
  });
});

describe('CSRF cookie decoding', () => {
  it('handles encoded tokens and ignores malformed segments without "="', () => {
    Object.defineProperty(document, 'cookie', {
      value: 'malformed_cookie_segment; csrftoken=abc%20123%25xyz',
      configurable: true,
    });
    expect(readCookie('csrftoken')).toBe('abc 123%xyz');
  });
});
