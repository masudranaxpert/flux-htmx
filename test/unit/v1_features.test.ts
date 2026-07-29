import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { getRetryOptions } from '../../src/core/retry.ts';
import { parseMaxSizeBytes, uploadPlugin } from '../../src/plugins/upload.ts';
import { optimisticPlugin } from '../../src/plugins/optimistic.ts';
import { applyPagination } from '../../src/presets/pagination.ts';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('Stable v1.0 Framework Features & Plugins Test Suite', () => {
  it('1. Automatic Retry: parses fx-retry options and calculates backoff', () => {
    const el = makeEl('<div fx-retry="3" fx-retry-delay="1s" fx-retry-backoff="2"></div>');
    const opts = getRetryOptions(el);
    expect(opts).not.toBeNull();
    expect(opts?.maxRetries).toBe(3);
    expect(opts?.delayMs).toBe(1000);
    expect(opts?.backoffFactor).toBe(2);
  });

  it('2. Pagination Preset: applies fx-page with append swap option', () => {
    const el = makeEl('<button fx-page="/items?page=2" fx-target="#items" fx-append>More</button>');
    const ok = applyPagination(el, {
      url: '/items?page=2',
      target: '#items',
      append: true,
    });
    expect(ok).toBe(true);
    expect(el.getAttribute('hx-get')).toBe('/items?page=2');
    expect(el.getAttribute('hx-swap')).toBe('beforeend');
    expect(el.getAttribute('hx-target')).toBe('#items');
  });

  it('3. Upload Progress Plugin: parses byte sizes correctly', () => {
    expect(parseMaxSizeBytes('20mb')).toBe(20971520);
    expect(parseMaxSizeBytes('500kb')).toBe(512000);
    expect(parseMaxSizeBytes('100')).toBe(100);
  });

  it('4. Optimistic UI Plugin: mutates DOM immediately on request and rolls back on failure', () => {
    Flux.dispose();
    Flux.configure();
    Flux.use(optimisticPlugin);

    const list = makeEl('<ul><li id="item-1">Item 1</li></ul>');
    document.body.appendChild(list);

    const btn = makeEl(
      '<button fx-delete="/item/1" fx-optimistic-remove="#item-1" fx-rollback>Delete</button>',
    );
    document.body.appendChild(btn);

    // Simulate htmx before request
    btn.dispatchEvent(
      new CustomEvent('htmx:before:request', { bubbles: true, detail: { elt: btn } }),
    );
    expect(document.querySelector('#item-1')).toBeNull();

    // Simulate htmx request error (trigger rollback)
    btn.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { elt: btn, successful: false, xhr: { status: 500 } },
      }),
    );
    expect(document.querySelector('#item-1')).not.toBeNull();
  });
});
