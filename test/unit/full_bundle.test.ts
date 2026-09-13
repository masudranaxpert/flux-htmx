import './setup.js';
import { describe, expect, it } from 'vitest';
import pkg from '../../package.json';
// Importing the FULL bundle must publish window.Flux with the UI plugins installed and
// auto-start them — the 1.x bug was flux.ts's module side effect winning the global race,
// so the full bundle's bootstrap() returned early and no UI plugin ever installed.
import '../../src/full.js';


describe('full bundle bootstrap', () => {
  it('publishes a full API object on window.Flux', () => {
    const Flux = (window as unknown as { Flux: Record<string, unknown> }).Flux;
    expect(Flux.version).toBe(pkg.version);
    expect(Flux.plugins).toBeDefined();
    expect(Flux.offline).toBeDefined();
    expect(Flux.htmx).toBeDefined();
  });

  it('tabs plugin is installed and activates panels on click', () => {
    document.body.innerHTML = `
      <div id="tabs-root" fx-tabs>
        <button id="tab-a" fx-tab="a">A</button>
        <button id="tab-b" fx-tab="b">B</button>
        <div id="panel-a" fx-panel="a">A content</div>
        <div id="panel-b" fx-panel="b" hidden>B content</div>
      </div>
    `;

    const tabB = document.querySelector('#tab-b')!;
    tabB.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(tabB.getAttribute('aria-selected')).toBe('true');
    const panelA = document.querySelector('#panel-a')!;
    expect(panelA.hasAttribute('hidden')).toBe(true);
    const panelB = document.querySelector('#panel-b')!;
    expect(panelB.hasAttribute('hidden')).toBe(false);
  });

  it('accordion plugin tracks disclosure state on data-fx-open, not fx-open', () => {
    document.body.innerHTML = `
      <div id="disclosure" fx-disclosure>
        <button id="disclosure-trigger" fx-disclosure-trigger aria-expanded="false">Toggle</button>
        <div id="disclosure-panel" fx-disclosure-panel hidden>Content</div>
      </div>
    `;

    const trigger = document.querySelector('#disclosure-trigger')!;
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const disclosure = document.querySelector('#disclosure')!;
    expect(disclosure.hasAttribute('fx-open')).toBe(false);
    expect(disclosure.getAttribute('data-fx-open')).toBe('');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('#disclosure-panel')!.hasAttribute('hidden')).toBe(false);
  });
});
