import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Monthly statement visual', () => {
  test('matches baseline render', async ({ page }) => {
    const html = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'monthly-statement.html'),
      'utf8',
    );

    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(100);

    const screenshot = await page.screenshot({ fullPage: true });
    expect(screenshot).toMatchSnapshot('monthly-statement.png');
  });
});
