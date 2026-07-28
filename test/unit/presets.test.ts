import { describe, expect, it } from 'vitest';
import { applyLoad } from '../../src/presets/load.js';
import { applyPoll } from '../../src/presets/poll.js';
import { applyInfinite } from '../../src/presets/infinite.js';
import { applyPreset } from '../../src/presets/index.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('fx-load', () => {
  it('expands to hx-get + load trigger', () => {
    const el = makeEl('<section fx-load="/stats"></section>');
    expect(applyLoad(el, { url: '/stats' })).toBe(true);
    expect(el.getAttribute('hx-get')).toBe('/stats');
    expect(el.getAttribute('hx-trigger')).toBe('load');
  });

  it('is idempotent', () => {
    const el = makeEl('<section fx-load="/stats"></section>');
    applyLoad(el, { url: '/stats' });
    expect(applyLoad(el, { url: '/stats' })).toBe(false);
  });
});

describe('fx-poll', () => {
  it('uses HTMX 4 every-syntax (not poll:)', () => {
    const el = makeEl('<div fx-poll="/updates" fx-interval="2s"></div>');
    expect(applyPoll(el, { url: '/updates', interval: '2s' })).toBe(true);
    expect(el.getAttribute('hx-trigger')).toBe('every 2s');
  });

  it('normalizes bare-number intervals to milliseconds', () => {
    const el = makeEl('<div></div>');
    applyPoll(el, { url: '/u', interval: '500' });
    expect(el.getAttribute('hx-trigger')).toBe('every 500ms');
  });

  it('defaults interval to 5s when fx-interval is missing', () => {
    const el = makeEl('<div fx-poll="/notifications"></div>');
    applyPreset(el, 'fx-poll', '/notifications', (attr) => el.getAttribute(attr) ?? undefined);
    expect(el.getAttribute('hx-get')).toBe('/notifications');
    expect(el.getAttribute('hx-trigger')).toBe('every 5s');
  });
});

describe('fx-infinite', () => {
  it('expands to hx-get + revealed trigger', () => {
    const el = makeEl('<div fx-infinite="/page/2"></div>');
    expect(applyInfinite(el, { url: '/page/2' })).toBe(true);
    expect(el.getAttribute('hx-get')).toBe('/page/2');
    expect(el.getAttribute('hx-trigger')).toBe('revealed');
  });
});
