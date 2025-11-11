import { expect, test } from '@playwright/test';

const shouldRun = Boolean(process.env.VISUAL_REGRESSION ?? process.env.CI);

test.describe('Visual regression smoke', () => {
  test.skip(!shouldRun, 'Visual regression checks disabled outside CI/opt-in runs.');

  test('token swatch matches baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1, height: 1 });
    await page.setContent(`
      <style>
        html, body {
          margin: 0;
          padding: 0;
          width: 1px;
          height: 1px;
          background: #164AAC;
        }
      </style>
      <div></div>
    `);
    await expect(page).toHaveScreenshot('token-swatch.png', { animations: 'disabled' });
  });
});
