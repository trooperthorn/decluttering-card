import { defineConfig, devices } from '@playwright/test';

// Visual regression, Platinum item from docs/quality-scale.md. Scoped
// deliberately narrow: this card's rendered output is mostly whatever
// underlying HA card/row/element it wraps (state-badge, ha-form, and other
// Home Assistant frontend internals aren't available outside a running HA
// frontend, so a full end-to-end screenshot of a real template isn't
// achievable standalone). What IS entirely self-rendered, with no HA
// internals involved, is for_each's own debug and empty-state views - those
// are what these tests screenshot.
export default defineConfig({
  testDir: './e2e',
  snapshotDir: './e2e/__screenshots__',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
