import { afterEach, describe, expect, it, vi } from 'vitest';
import { me } from '../../src/core/sugar.js';

function makeEl(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html.trim();
  return container.firstElementChild as HTMLElement;
}

// Regression: fadeIn used to snapshot style.cssText and write it back at the end, which wiped any
// inline styles applied during the animation window (e.g. dropdown-flip positioning applied by the
// host app right after opening). It now restores only opacity/transition/overflow, so callers no
// longer need to delay their own style work until after the fade completes.
describe('fadeIn preserves unrelated inline styles', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('keeps inline styles applied during the animation (dropdown-flip case)', async () => {
    const el = makeEl('<div class="hidden"></div>');
    document.body.append(el);

    vi.useFakeTimers();
    me(el)?.fadeIn(undefined, 20); // snapshot is taken synchronously here, before the flip below
    el.style.transform = 'translateX(50px)'; // host app flips mid-animation
    await vi.runAllTimersAsync();

    expect(el.style.transform).toBe('translateX(50px)'); // would be '' under the cssText wipe
    // Fade bookkeeping cleaned up afterwards; element left visible.
    expect(el.style.overflow).toBe('');
    expect(el.style.transition).toBe('');
    expect(el.classList.contains('hidden')).toBe(false);
  });
});
