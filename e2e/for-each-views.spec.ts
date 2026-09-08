import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

// Loads the real built bundle (npm run build must run first - see package.json's
// pretest-equivalent in CI) so this exercises actual shipped code, not a
// reimplementation of it.
const BUNDLE = readFileSync(join(__dirname, '../dist/decluttering-card.js'), 'utf-8');

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8">
<style>body{margin:0;padding:16px;background:#fff;font-family:sans-serif;}</style>
</head><body>
<decluttering-card></decluttering-card>
<script type="module">${BUNDLE}</script>
</body></html>`;

test.beforeEach(async ({ page }) => {
  await page.setContent(PAGE, { waitUntil: 'load' });
  await page.waitForFunction(() => customElements.get('decluttering-card') !== undefined);
});

test('for_each debug view renders each match with its resolved variables', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.querySelector('decluttering-card') as any;
    el._forEachConfig = { type: 'custom:decluttering-card', template: 'x', for_each: { debug: true } };
    el._forEachDebugRows = [
      { key: 'binary_sensor.kitchen_leak', variables: { entity: 'binary_sensor.kitchen_leak', name: 'Kitchen Leak', area: 'Kitchen', domain: 'binary_sensor' } },
      { key: 'binary_sensor.garage_leak', variables: { entity: 'binary_sensor.garage_leak', name: 'Garage Leak', area: 'Garage', domain: 'binary_sensor' } },
    ];
    el.requestUpdate();
  });
  await page.waitForTimeout(50);
  await expect(page.locator('decluttering-card')).toHaveScreenshot('for-each-debug-view.png');
});

test('for_each debug view with zero matches shows the no-match message', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.querySelector('decluttering-card') as any;
    el._forEachConfig = { type: 'custom:decluttering-card', template: 'x', for_each: { debug: true } };
    el._forEachDebugRows = [];
    el.requestUpdate();
  });
  await page.waitForTimeout(50);
  await expect(page.locator('decluttering-card')).toHaveScreenshot('for-each-debug-empty.png');
});

test('for_each with zero real matches and an empty_message shows it', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.querySelector('decluttering-card') as any;
    el._forEachConfig = {
      type: 'custom:decluttering-card',
      template: 'x',
      for_each: { empty_message: 'No leak sensors are configured yet.' },
    };
    el._forEachGroups = [];
    el.requestUpdate();
  });
  await page.waitForTimeout(50);
  await expect(page.locator('decluttering-card')).toHaveScreenshot('for-each-empty-message.png');
});
