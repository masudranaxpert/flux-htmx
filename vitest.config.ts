import { defineConfig } from 'vitest/config';

// Unit tests run in jsdom. jsdom cannot execute HTMX's real fetch/swap loop, so lifecycle
// and end-to-end behaviour is covered by the Playwright suite in test/e2e.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/unit/**/*.test.ts'],
  },
});
