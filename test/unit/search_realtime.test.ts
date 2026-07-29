import './setup.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Flux from '../../src/flux.js';
import { applySearch, disconnectSearch } from '../../src/presets/search.js';
import { applyRealtime, disconnectRealtime } from '../../src/presets/realtime.js';

function makeEl(html: string): Element {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstElementChild!;
}

describe('fx-search — native debounce, eval-free', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    document.body.innerHTML = '';
    Flux.configure();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets hx-get, hx-trigger=flux:search-ready, hx-sync on element', () => {
    const el = makeEl('<input type="search">');
    document.body.appendChild(el);
    const ok = applySearch(el, { url: '/search' });
    expect(ok).toBe(true);
    expect(el.getAttribute('hx-get')).toBe('/search');
    expect(el.getAttribute('hx-trigger')).toBe('flux:search-ready');
    expect(el.getAttribute('hx-sync')).toBe('this:replace');
  });

  it('dispatches flux:search-ready after debounce delay', async () => {
    const el = makeEl('<input type="search">') as HTMLInputElement;
    document.body.appendChild(el);
    applySearch(el, { url: '/search', delay: '200' });

    let fired = false;
    el.addEventListener('flux:search-ready', () => {
      fired = true;
    });

    el.value = 'hello';
    el.dispatchEvent(new Event('input'));
    expect(fired).toBe(false);

    vi.advanceTimersByTime(200);
    expect(fired).toBe(true);
  });

  it('respects min-length: does NOT fire if value is too short', () => {
    const el = makeEl('<input type="search">') as HTMLInputElement;
    document.body.appendChild(el);
    applySearch(el, { url: '/search', delay: '100', minLength: '3' });

    let fired = false;
    el.addEventListener('flux:search-ready', () => {
      fired = true;
    });

    el.value = 'ab'; // only 2 chars
    el.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(200);
    expect(fired).toBe(false);
  });

  it('fires when value meets min-length', () => {
    const el = makeEl('<input type="search">') as HTMLInputElement;
    document.body.appendChild(el);
    applySearch(el, { url: '/search', delay: '100', minLength: '2' });

    let fired = false;
    el.addEventListener('flux:search-ready', () => {
      fired = true;
    });

    el.value = 'ab'; // exactly 2
    el.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(150);
    expect(fired).toBe(true);
  });

  it('disconnectSearch removes listener (no more events)', () => {
    const el = makeEl('<input type="search">') as HTMLInputElement;
    document.body.appendChild(el);
    applySearch(el, { url: '/search', delay: '100' });

    let fired = false;
    el.addEventListener('flux:search-ready', () => {
      fired = true;
    });

    disconnectSearch(el);
    el.value = 'test';
    el.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(200);
    expect(fired).toBe(false);
  });

  it('clear button fires flux:search-ready and clears value', () => {
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear';
    document.body.appendChild(clearBtn);

    const el = makeEl('<input type="search">') as HTMLInputElement;
    el.value = 'hello';
    document.body.appendChild(el);
    applySearch(el, { url: '/search', clearSelector: '#clear' });

    let fired = false;
    el.addEventListener('flux:search-ready', () => {
      fired = true;
    });

    clearBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.value).toBe('');
    expect(fired).toBe(true);
  });
});

describe('fx-realtime — SSE preset', () => {
  type RealtimeListener = (event: { data: string }) => void;
  interface MockEventSourceInstance {
    url: string;
    opts: { withCredentials?: boolean };
    listeners: Map<string, RealtimeListener>;
    addEventListener: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }

  let MockEventSource: ReturnType<typeof vi.fn>;
  const getLastInstance = () =>
    MockEventSource.mock.instances.at(-1) as unknown as MockEventSourceInstance;

  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    document.body.innerHTML = '';

    // Mock native EventSource
    class EventSourceMock implements MockEventSourceInstance {
      listeners = new Map<string, RealtimeListener>();
      addEventListener = vi.fn((event: string, cb: RealtimeListener) => {
        this.listeners.set(event, cb);
      });
      close = vi.fn();

      constructor(
        public url: string,
        public opts: { withCredentials?: boolean },
      ) {}
    }
    MockEventSource = vi.fn(EventSourceMock);
    (global as any).EventSource = MockEventSource;
  });

  afterEach(() => {
    delete (global as any).EventSource;
  });

  it('returns false and warns when EventSource is not available', () => {
    delete (global as any).EventSource;
    const el = document.createElement('div');
    const ok = applyRealtime(el, { url: '/events' });
    expect(ok).toBe(false);
  });

  it('opens an EventSource to the given URL', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const ok = applyRealtime(el, { url: '/events/live' });
    expect(ok).toBe(true);
    expect(MockEventSource).toHaveBeenCalledWith(
      '/events/live',
      expect.objectContaining({ withCredentials: false }),
    );
  });

  it('sets data-flux-preset=realtime on element', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    applyRealtime(el, { url: '/events' });
    expect(el.getAttribute('data-flux-preset')).toBe('realtime');
  });

  it('swaps innerHTML on SSE message', () => {
    const target = document.createElement('div');
    target.id = 'feed';
    document.body.appendChild(target);

    const el = document.createElement('div');
    document.body.appendChild(el);

    applyRealtime(el, { url: '/events', target: '#feed' });

    const cb = getLastInstance().listeners.get('message')!;
    cb({ data: '<p>Hello live!</p>' });

    expect(target.innerHTML).toBe('<p>Hello live!</p>');
  });

  it('dispatches flux:realtime:message on message', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    applyRealtime(el, { url: '/events' });

    let detail: any = null;
    el.addEventListener('flux:realtime:message', (e) => {
      detail = (e as CustomEvent).detail;
    });

    const cb = getLastInstance().listeners.get('message')!;
    cb({ data: '<p>data</p>' });

    expect(detail?.url).toBe('/events');
    expect(detail?.data).toBe('<p>data</p>');
  });

  it('disconnectRealtime closes the EventSource', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    applyRealtime(el, { url: '/events' });
    disconnectRealtime(el);

    expect(getLastInstance().close).toHaveBeenCalled();
  });

  it('listens to custom event name when fx-event is provided', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);

    applyRealtime(el, { url: '/events', event: 'update' });

    expect(getLastInstance().addEventListener).toHaveBeenCalledWith('update', expect.any(Function));
  });
});
