import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8'),
) as { version: string };

// Waits for an htmx request cycle to settle: the request class is applied during the request
// and removed after, so waiting for it to clear is a robust "swap done" signal. Falls back to
// polling the target's text content when there is no in-flight request to observe.
async function waitForSwap(page: Page, targetSelector: string, expectedText?: string) {
  if (expectedText) {
    await expect(page.locator(targetSelector)).toContainText(expectedText, { timeout: 5_000 });
    return;
  }
  // htmx adds 'htmx-request' to the triggering element during the request.
  await page.waitForTimeout(150);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('fx-get on initial DOM is processed and performs a request', async ({ page }) => {
  // After load, htmx should have discovered the expanded hx-get on btn1.
  await expect(page.locator('#btn1')).toHaveAttribute('hx-get', '/fragment/hello');

  await page.click('#btn1');
  await waitForSwap(page, '#result1', 'Hello from server');
  await expect(page.locator('#result1')).toContainText('Hello from server');
});

test('raw hx-* escape hatch works alongside Flux', async ({ page }) => {
  // btn2 is raw hx-*; Flux must leave it intact.
  await expect(page.locator('#btn2')).toHaveAttribute('hx-get', '/fragment/hello');
  await expect(page.locator('#btn2')).not.toHaveAttribute('fx-get');

  await page.click('#btn2');
  await waitForSwap(page, '#result2', 'Hello from server');
  await expect(page.locator('#result2')).toContainText('Hello from server');
});

test('mixed fx-* and hx-*: raw hx-target wins, fx-get expands', async ({ page }) => {
  // fx-get should have expanded to hx-get; the explicit hx-target must be preserved.
  await expect(page.locator('#btn3')).toHaveAttribute('hx-get', '/fragment/hello');
  await expect(page.locator('#btn3')).toHaveAttribute('hx-target', '#result3');

  await page.click('#btn3');
  await waitForSwap(page, '#result3', 'Hello from server');
  await expect(page.locator('#result3')).toContainText('Hello from server');
});

test('swapped content with fx-get is processed and works', async ({ page }) => {
  // Load the swapped fragment (which contains its own fx-get button).
  await page.click('#load-swapped');
  await expect(page.locator('#swapped-btn')).toBeVisible();

  // The freshly swapped button's fx-get must have been expanded to hx-get by Flux.
  await expect(page.locator('#swapped-btn')).toHaveAttribute('hx-get', '/fragment/hello');

  // And it must actually work.
  await page.click('#swapped-btn');
  await waitForSwap(page, '#result2', 'Hello from server');
  await expect(page.locator('#result2')).toContainText('Hello from server');
});

test('repeated Flux.process() is idempotent (no duplicate handlers)', async ({ page }) => {
  // Calling process() again must not double-register: a single click fires exactly one request.
  // We instrument fetch to count requests triggered by btn1.
  const requestCount = await page.evaluate(() => {
    let count = 0;
    const original = window.fetch;
    window.fetch = function (...args) {
      count++;
      return original.apply(this, args);
    };
    (window as unknown as { __fluxRequestCount: () => number }).__fluxRequestCount = () => count;
    return 0;
  });
  expect(requestCount).toBe(0);

  // Re-process the document body several times.
  await page.evaluate(() => {
    const Flux = (window as unknown as { Flux?: { process: (el?: Element) => void } }).Flux;
    Flux?.process(document.body);
    Flux?.process(document.body);
    Flux?.process(document.body);
  });

  await page.click('#btn1');
  await waitForSwap(page, '#result1', 'Hello from server');

  const after = await page.evaluate(() =>
    (window as unknown as { __fluxRequestCount: () => number }).__fluxRequestCount(),
  );
  expect(after).toBe(1);
});

test('exposes the correct global IIFE API shape without default wrapper', async ({ page }) => {
  const result = await page.evaluate(() => ({
    version: (window as any).Flux.version,
    startType: typeof (window as any).Flux.start,
    startedType: typeof (window as any).Flux.isStarted,
    hasDefaultWrapper: 'default' in (window as any).Flux,
  }));

  expect(result).toEqual({
    version: pkg.version,
    startType: 'function',
    startedType: 'boolean',
    hasDefaultWrapper: false,
  });
});

test('reuses the same global instance on duplicate script load', async ({ page }) => {
  const first = await page.evaluateHandle(() => (window as any).Flux);

  await page.addScriptTag({
    path: 'dist/flux.iife.js',
  });

  const same = await page.evaluate((firstFlux) => (window as any).Flux === firstFlux, first);

  expect(same).toBe(true);
});

test('activates pre-installed plugin once on start', async ({ page }) => {
  const count = await page.evaluate(() => {
    let setups = 0;

    (window as any).Flux.use({
      name: 'activation-test',
      setup() {
        setups++;
      },
    });

    (window as any).Flux.start();

    return setups;
  });

  expect(count).toBe(1);
});

test('cleans removed presets and empty preset URLs in one process pass', async ({ page }) => {
  const result = await page.evaluate(() => {
    const Flux = (window as any).Flux;

    const form = document.createElement('form');
    form.setAttribute('fx-submit', '/gone');
    form.setAttribute('fx-target', '#result1');
    document.body.appendChild(form);
    Flux.process(form);

    form.removeAttribute('fx-submit');
    form.removeAttribute('fx-target');
    Flux.process(form);

    const emptyForm = document.createElement('form');
    emptyForm.setAttribute('fx-submit', '/ok');
    document.body.appendChild(emptyForm);
    Flux.process(emptyForm);
    emptyForm.setAttribute('fx-submit', '');
    Flux.process(emptyForm);

    return {
      removedPost: form.getAttribute('hx-post'),
      removedTarget: form.getAttribute('hx-target'),
      removedPreset: form.getAttribute('data-flux-preset'),
      emptyPost: emptyForm.getAttribute('hx-post'),
      emptyPreset: emptyForm.getAttribute('data-flux-preset'),
    };
  });

  expect(result).toEqual({
    removedPost: null,
    removedTarget: null,
    removedPreset: null,
    emptyPost: null,
    emptyPreset: null,
  });
});

test('disconnects upload listeners when fx-upload is removed', async ({ page }) => {
  const result = await page.evaluate(() => {
    const Flux = (window as any).Flux;
    const FluxNet = (window as any).FluxNet;
    Flux.use(FluxNet.uploadPlugin);
    const form = document.createElement('form');
    form.setAttribute('fx-upload', '/upload');
    document.body.appendChild(form);
    Flux.process(form);

    form.removeAttribute('fx-upload');
    Flux.process(form);
    form.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));

    return {
      post: form.getAttribute('hx-post'),
      preset: form.getAttribute('data-flux-preset'),
      dragOver: form.getAttribute('data-flux-drag-over'),
    };
  });

  expect(result).toEqual({ post: null, preset: null, dragOver: null });
});
