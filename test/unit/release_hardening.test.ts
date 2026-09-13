import './setup.js';
import { describe, expect, it, vi } from 'vitest';
import { installCacheIntegration } from '../../src/cache/cacheWire.js';
import { FragmentCache } from '../../src/cache/cache.js';
import { installFeedback, resetFeedbackForTests } from '../../src/core/feedback.js';
import {
  installOpenController,
  disposeDialogControllers,
} from '../../src/components/components.js';

function makeEl(html: string): Element {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as Element;
}

describe('GET cache key parameter serialization', () => {
  it('serializes input values into URL query parameters for distinct cache keys', () => {
    const cache = new FragmentCache();
    installCacheIntegration(cache);

    const input1 = makeEl('<input name="q" value="apple" fx-cache="60s" />');
    document.body.appendChild(input1);
    input1.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: input1,
            request: { method: 'GET', action: '/search', parameters: { q: 'apple' } },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Apple Results</div>',
        },
      }),
    );

    const input2 = makeEl('<input name="q" value="banana" fx-cache="60s" />');
    document.body.appendChild(input2);
    input2.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: input2,
            request: { method: 'GET', action: '/search', parameters: { q: 'banana' } },
            successful: true,
            response: { status: 200 },
          },
          text: '<div>Banana Results</div>',
        },
      }),
    );

    expect(cache.get('GET:/search?q=apple')).toBe('<div>Apple Results</div>');
    expect(cache.get('GET:/search?q=banana')).toBe('<div>Banana Results</div>');
  });
});

describe('htmx:finally:request indicator balancing and data-flux-* state attributes', () => {
  it('toggles data-flux-loading and clears on finally:request', () => {
    resetFeedbackForTests();
    installFeedback();

    const source = makeEl('<button fx-get="/test">Fetch</button>');
    document.body.appendChild(source);

    // Real HTMX 4 passes the SAME ctx object to before:request and finally:request.
    const ctx = { sourceElement: source };
    const beforeEvt = new CustomEvent('htmx:before:request', {
      bubbles: true,
      detail: { ctx },
    });
    source.dispatchEvent(beforeEvt);

    expect(source.getAttribute('data-flux-loading')).toBe('1');

    const finallyEvt = new CustomEvent('htmx:finally:request', {
      bubbles: true,
      detail: { ctx },
    });
    source.dispatchEvent(finallyEvt);

    expect(source.hasAttribute('data-flux-loading')).toBe(false);
    resetFeedbackForTests();
  });

  it('keeps global indicator active when finally:request fires without a matching before:request (confirm-cancel)', () => {
    resetFeedbackForTests();
    const spinner = makeEl('<div id="global-spinner"></div>');
    document.body.appendChild(spinner);
    // Indicator selector resolved via flux-feedback meta — no config cast needed.
    const meta = makeEl('<meta name="flux-feedback" />') as HTMLMetaElement;
    meta.content = JSON.stringify({ indicator: '#global-spinner' });
    document.head.appendChild(meta);
    installFeedback();

    const sourceA = makeEl('<button fx-get="/a">A</button>');
    const sourceB = makeEl('<button fx-get="/b">B</button>');
    document.body.appendChild(sourceA);
    document.body.appendChild(sourceB);

    // Request A starts normally via before:request
    const ctxA = { sourceElement: sourceA };
    sourceA.dispatchEvent(
      new CustomEvent('htmx:before:request', { bubbles: true, detail: { ctx: ctxA } }),
    );
    expect(sourceA.getAttribute('data-flux-loading')).toBe('1');
    expect(spinner.hasAttribute('data-flux-active')).toBe(true);

    // Request B is dropped at htmx:confirm: finally:request fires with NO preceding before:request
    const ctxB = { sourceElement: sourceB };
    sourceB.dispatchEvent(
      new CustomEvent('htmx:finally:request', { bubbles: true, detail: { ctx: ctxB } }),
    );

    // A is still in flight: indicator and A's loading must survive B's orphaned finally
    expect(spinner.hasAttribute('data-flux-active')).toBe(true);
    expect(sourceA.getAttribute('data-flux-loading')).toBe('1');

    resetFeedbackForTests();
    spinner.remove();
    sourceA.remove();
    sourceB.remove();
    meta.remove();
  });

  it('sets data-flux-success on 2xx and data-flux-error on 4xx/5xx', () => {
    resetFeedbackForTests();
    installFeedback();

    const source = makeEl('<button fx-post="/save">Save</button>');
    document.body.appendChild(source);

    source.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: source,
            response: { status: 200 },
            successful: true,
          },
        },
      }),
    );

    expect(source.getAttribute('data-flux-success')).toBe('1');
    expect(source.hasAttribute('data-flux-error')).toBe(false);

    source.dispatchEvent(
      new CustomEvent('htmx:after:request', {
        bubbles: true,
        detail: {
          ctx: {
            sourceElement: source,
            response: { status: 500 },
            successful: false,
          },
        },
      }),
    );

    expect(source.getAttribute('data-flux-error')).toBe('1');
    expect(source.hasAttribute('data-flux-success')).toBe(false);
    resetFeedbackForTests();
  });
});

describe('dialog close listener disposal', () => {
  it('cleans up element-level dialog close controllers on dispose', () => {
    const teardown = installOpenController();
    const dialog = document.createElement('dialog');
    dialog.id = 'test-dialog';
    dialog.showModal = vi.fn();
    dialog.close = vi.fn();
    document.body.appendChild(dialog);

    const openBtn = makeEl('<button fx-open="#test-dialog"></button>');
    document.body.appendChild(openBtn);

    openBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(dialog.getAttribute('data-flux-close-wired')).toBe('1');

    disposeDialogControllers();
    expect(dialog.hasAttribute('data-flux-close-wired')).toBe(false);

    teardown();
  });
});
