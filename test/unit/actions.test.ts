import './setup.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Flux from '../../src/flux.js';
import { registerAction } from '../../src/core/actions.js';

describe('Action Pipeline (fx-on-success / fx-success-action)', () => {
  beforeEach(() => {
    Flux.dispose({ removeGeneratedAttributes: true });
    document.body.innerHTML = '';
    Flux.configure();
  });

  it('executes inline pipeline on htmx:afterRequest if successful', async () => {
    const el = document.createElement('form');
    el.setAttribute('fx-on-success', 'custom1:foo; custom2');
    document.body.appendChild(el);

    const spy1 = vi.fn();
    const spy2 = vi.fn();
    registerAction('custom1', spy1);
    registerAction('custom2', spy2);

    const event = new CustomEvent('htmx:afterRequest', {
      bubbles: true,
      detail: { elt: el, successful: true, failed: false }
    });
    document.dispatchEvent(event);

    // Using setTimeout to wait for async pipeline execution
    await new Promise(r => setTimeout(r, 10));

    expect(spy1).toHaveBeenCalledWith('foo', el, event.detail);
    expect(spy2).toHaveBeenCalledWith('', el, event.detail);
  });

  it('executes named pipeline on htmx:afterRequest if successful', async () => {
    Flux.action('my-pipeline', ['custom3:bar', 'custom4']);

    const el = document.createElement('form');
    el.setAttribute('fx-success-action', 'my-pipeline');
    document.body.appendChild(el);

    const spy3 = vi.fn();
    const spy4 = vi.fn();
    registerAction('custom3', spy3);
    registerAction('custom4', spy4);

    const event = new CustomEvent('htmx:afterRequest', {
      bubbles: true,
      detail: { elt: el, successful: true, failed: false }
    });
    document.dispatchEvent(event);

    await new Promise(r => setTimeout(r, 10));

    expect(spy3).toHaveBeenCalledWith('bar', el, event.detail);
    expect(spy4).toHaveBeenCalledWith('', el, event.detail);
  });

  it('executes fx-on-error on failed request', async () => {
    const el = document.createElement('form');
    el.setAttribute('fx-on-error', 'customError:baz');
    document.body.appendChild(el);

    const spyError = vi.fn();
    registerAction('customError', spyError);

    const event = new CustomEvent('htmx:afterRequest', {
      bubbles: true,
      detail: { elt: el, successful: false, failed: true }
    });
    document.dispatchEvent(event);

    await new Promise(r => setTimeout(r, 10));

    expect(spyError).toHaveBeenCalledWith('baz', el, event.detail);
  });

  it('built-in actions: close dialog', async () => {
    const dialog = document.createElement('dialog');
    dialog.id = 'my-dialog';
    dialog.setAttribute('open', '');
    document.body.appendChild(dialog);

    const el = document.createElement('button');
    el.setAttribute('fx-on-success', 'close:#my-dialog');
    document.body.appendChild(el);

    const event = new CustomEvent('htmx:afterRequest', {
      bubbles: true,
      detail: { elt: el, successful: true, failed: false }
    });
    document.dispatchEvent(event);

    await new Promise(r => setTimeout(r, 10));
    console.log("Dialog in DOM?", document.getElementById('my-dialog') !== null);
    console.log("queryMany:", document.querySelectorAll('#my-dialog').length);
    expect(dialog.hasAttribute('open')).toBe(false);
  });
});
