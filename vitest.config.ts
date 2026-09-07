import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // e2e/ holds Playwright specs (visual regression, see
    // playwright.config.ts) - vitest's default include pattern would
    // otherwise also try to run them as unit tests.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
