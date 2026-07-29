import './setup.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Flux from '../../src/flux.js';
import { cache } from '../../src/cache/instance.js';
import { cacheKey } from '../../src/cache/cacheWire.js';
import { resetFeedbackForTests } from '../../src/core/feedback.js';

function makeEl(html: string): Element {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstElementChild!;
}

describe('New Features: fx-prefetch and fx-toast', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    cache.clear();
    document.body.innerHTML = '';
    resetFeedbackForTests();
    Flux.configure();
  });

  it('fx-prefetch: fetches URL and populates cache on mouseenter', async () => {
    const el = makeEl('<a fx-prefetch fx-get="/test-prefetch">Hover me</a>');
    document.body.appendChild(el);
    Flux.process(document.body);

    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('prefetched content'),
      headers: { get: () => null },
    });
    global.fetch = mockFetch as any;

    // Trigger mouseenter
    el.dispatchEvent(new MouseEvent('mouseenter'));

    // Wait for fetch to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockFetch).toHaveBeenCalledWith(
      '/test-prefetch',
      expect.objectContaining({
        headers: expect.objectContaining({
          'HX-Request': 'true',
          'X-Flux-Prefetch': 'true',
        }),
      }),
    );

    const key = cacheKey(el, { method: 'GET', action: '/test-prefetch' });
    const cached = cache.get(key);
    expect(cached).toBe('prefetched content');
  });

  it('fx-toast: shows a visible toast element when fx-toast is present', async () => {
    const el = makeEl('<button fx-post="/delete" fx-toast fx-error="Action failed">Click</button>');
    document.body.appendChild(el);
    Flux.process(document.body);

    el.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          xhr: {},
          successful: false,
          isError: true,
          elt: el,
          requestConfig: { verb: 'post' },
        },
      }),
    );

    // Toast should be appended to body
    const toast = document.querySelector('.flux-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain('Action failed');
    expect(toast?.classList.contains('flux-toast-error')).toBe(true);
  });

  it('fx-history: expands to hx-push-url="true"', () => {
    const el = makeEl('<a fx-history>Link</a>');
    Flux.process(el);
    expect(el.getAttribute('hx-push-url')).toBe('true');
  });

  it('fx-validate: prevents default on invalid form submit', () => {
    const el = makeEl(`
      <form fx-submit="/post" fx-validate>
        <input name="email" type="email" required>
        <button type="submit">Submit</button>
      </form>
    `);
    document.body.appendChild(el);
    Flux.process(el);

    const form = el as HTMLFormElement;
    // JSDOM supports reportValidity
    const spy = vi.spyOn(form, 'reportValidity').mockReturnValue(false);

    let prevented = false;
    const confirmEvent = new CustomEvent('htmx:confirm', {
      bubbles: true,
      cancelable: true,
      detail: { elt: el },
    });
    confirmEvent.preventDefault = () => {
      prevented = true;
    };

    el.dispatchEvent(confirmEvent);

    expect(spy).toHaveBeenCalled();
    expect(prevented).toBe(true);
  });
});
