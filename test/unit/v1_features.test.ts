import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { FLUX_VERSION } from '../../src/core/version.ts';
import { getRetryOptions } from '../../src/core/retry.ts';
import { parseMaxSizeBytes, uploadPlugin } from '../../src/plugins/upload.ts';
import { optimisticPlugin } from '../../src/plugins/optimistic.ts';
import { applyPagination } from '../../src/presets/pagination.ts';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('Stable v1.0.0 Release Hardening & Features Test Suite', () => {
  it('1. Version: exposes v1.0.0 release version', () => {
    expect(FLUX_VERSION).toBe('1.0.0');
    expect(Flux.default.version).toBe('1.0.0');
  });

  it('2. Automatic Retry: parses fx-retry options and calculates backoff', () => {
    const el = makeEl('<div fx-retry="3" fx-retry-delay="1s" fx-retry-backoff="2"></div>');
    const opts = getRetryOptions(el);
    expect(opts).not.toBeNull();
    expect(opts?.maxRetries).toBe(3);
    expect(opts?.delayMs).toBe(1000);
    expect(opts?.backoffFactor).toBe(2);
  });

  it('3. Pagination Preset: applies fx-page and cleans up stale hx-swap on option removal', () => {
    const el = makeEl('<button fx-page="/items?page=2" fx-target="#items" fx-append>More</button>');
    const ok = applyPagination(el, {
      url: '/items?page=2',
      target: '#items',
      append: true,
    });
    expect(ok).toBe(true);
    expect(el.getAttribute('hx-get')).toBe('/items?page=2');
    expect(el.getAttribute('hx-swap')).toBe('beforeend');

    // Remove append option and re-apply
    const ok2 = applyPagination(el, {
      url: '/items?page=2',
      target: '#items',
      append: false,
    });
    expect(ok2).toBe(true);
    expect(el.getAttribute('hx-swap')).toBeNull();
  });

  it('4. Upload Progress Plugin: parses byte sizes, handles drag-and-drop and cleans up on dispose', () => {
    expect(parseMaxSizeBytes('20mb')).toBe(20971520);
    expect(parseMaxSizeBytes('500kb')).toBe(512000);
    expect(parseMaxSizeBytes('100')).toBe(100);

    Flux.dispose();
    Flux.configure();
    Flux.use(uploadPlugin);

    const form = makeEl(
      '<form fx-upload="/files" fx-max-size="10mb"><input type="file" name="doc"/></form>',
    );
    document.body.appendChild(form);
    Flux.process(document.body);

    const dragOverEvt = new CustomEvent('dragover', { bubbles: true, cancelable: true });
    form.dispatchEvent(dragOverEvt);
    expect(form.getAttribute('data-flux-drag-over')).toBe('1');

    const dragLeaveEvt = new CustomEvent('dragleave', { bubbles: true });
    form.dispatchEvent(dragLeaveEvt);
    expect(form.getAttribute('data-flux-drag-over')).toBeNull();

    Flux.dispose({ removeGeneratedAttributes: true });
    expect(form.getAttribute('hx-post')).toBeNull();
  });

  it('5. Optimistic UI Plugin: requires explicit fx-rollback for DOM rollback', () => {
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

    // Simulate htmx request error with fx-rollback opt-in
    btn.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: { elt: btn, successful: false, xhr: { status: 500 } },
      }),
    );
    expect(document.querySelector('#item-1')).not.toBeNull();
  });
});
