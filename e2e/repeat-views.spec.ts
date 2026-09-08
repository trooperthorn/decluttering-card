import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

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

test('repeat debug view renders each item with its resolved variables', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.querySelector('decluttering-card') as any;
    el._repeatConfig = { type: 'custom:decluttering-card', template: 'x', repeat: { items: [], debug: true } };
    el._repeatDebugRows = [
      { key: 'ON', variables: { command: 'on', name: 'ON' } },
      { key: 'STANDBY', variables: { command: 'standby', name: 'STANDBY' } },
    ];
    el.requestUpdate();
  });
  await page.waitForTimeout(50);
  await expect(page.locator('decluttering-card')).toHaveScreenshot('repeat-debug-view.png');
});

test('repeat debug view with an empty items list shows the no-items message', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.querySelector('decluttering-card') as any;
    el._repeatConfig = { type: 'custom:decluttering-card', template: 'x', repeat: { items: [], debug: true } };
    el._repeatDebugRows = [];
    el.requestUpdate();
  });
  await page.waitForTimeout(50);
  await expect(page.locator('decluttering-card')).toHaveScreenshot('repeat-debug-empty.png');
});

test('repeat with an empty items list and an empty_message shows it', async ({ page }) => {
  await page.evaluate(() => {
    const el = document.querySelector('decluttering-card') as any;
    el._repeatConfig = {
      type: 'custom:decluttering-card',
      template: 'x',
      repeat: { items: [], empty_message: 'No remote buttons configured yet.' },
    };
    el._repeatGroups = [{ label: '', items: [] }];
    el.requestUpdate();
  });
  await page.waitForTimeout(50);
  await expect(page.locator('decluttering-card')).toHaveScreenshot('repeat-empty-message.png');
});
