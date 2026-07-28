import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Browser integration tests. These start the fixture HTTP server (test/e2e/server.mjs) which
// serves real htmx 4 + the Flux IIFE bundle and HTML fragments, then drive Chromium.
const PORT = process.env.FLUX_E2E_PORT ?? '4317';
const baseURL = `http://localhost:${PORT}`;
const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.e2e\.ts/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    headless: true,
  },
  webServer: {
    command: `node server.mjs`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
    cwd: here,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
