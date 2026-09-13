import './setup.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Flux from '../../src/flux.js';

beforeEach(() => Flux.configure());
afterEach(() => {
  Flux.dispose();
  document.body.innerHTML = '';
});

const settle = () => new Promise((r) => setTimeout(r, 5));

describe('fx-log', () => {
  it('keeps scroll pinned at bottom and caps lines', async () => {
    document.body.innerHTML = `<div id="log" fx-log="3" style="height:50px;overflow:auto"></div>`;
    const log = document.getElementById('log')!;
    Object.defineProperty(log, 'clientHeight', { value: 50 });
    Object.defineProperty(log, 'scrollHeight', { value: 200, configurable: true });
    log.scrollTop = 150; // pinned at bottom
    const line = document.createElement('div');
    line.textContent = 'l1';
    log.appendChild(line);
    await settle();
    expect(log.children.length).toBeLessThanOrEqual(3);
    expect(log.scrollTop).toBe(200); // pinned to (mock) bottom
  });
});

describe('fx-copy', () => {
  it('copies target text and shows feedback', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
    document.body.innerHTML = `<code id="tok">secret-123</code><button fx-copy="#tok">Copy</button>`;
    document.querySelector('button')!.click();
    await settle();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('secret-123');
    expect(document.querySelector('button')!.getAttribute('data-flux-copied')).toBe('true');
  });
});

describe('fx-ago', () => {
  it('renders relative time from datetime', async () => {
    document.body.innerHTML = `<time fx-ago datetime="${new Date(Date.now() - 60_000).toISOString()}"></time>`;
    document.dispatchEvent(new CustomEvent('htmx:after:settle'));
    await settle();
    expect(document.querySelector('time')!.textContent).toMatch(/minute|second/i);
  });
});

describe('fx-shortcut', () => {
  it('clicks the bound element on key match', () => {
    document.body.innerHTML = `<button fx-shortcut="ctrl+k" id="pal">Palette</button>`;
    const spy = vi.fn();
    document.getElementById('pal')!.addEventListener('click', spy);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
    );
    expect(spy).toHaveBeenCalled();
  });
});

describe('unsaved-changes guard', () => {
  it('beforeunload blocks when a flux-dirty form is dirty', () => {
    document.body.innerHTML = `<form fx-dirty data-dirty="true"><input name="a" /></form>`;
    const event = new Event('beforeunload') as Event & {
      returnValue?: string;
      preventDefault: () => void;
    };
    vi.spyOn(event, 'preventDefault').mockImplementation(() => {});
    window.dispatchEvent(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

describe('upload progress', () => {
  it('updates data-flux-progress and <progress>', () => {
    document.body.innerHTML = `<form hx-post="/up"><progress max="100"></progress></form>`;
    const form = document.querySelector('form')!;
    form.dispatchEvent(
      new CustomEvent('htmx:xhr:progress', {
        bubbles: true,
        detail: { lengthComputable: true, loaded: 42, total: 100 },
      }),
    );
    expect(form.getAttribute('data-flux-progress')).toBe('42');
    expect((form.querySelector('progress') as HTMLProgressElement).value).toBe(42);
  });
});
