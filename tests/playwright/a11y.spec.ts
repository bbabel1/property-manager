import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

test.describe('Monthly statement accessibility', () => {
  test('has no Axe violations (WCAG 2 A/AA)', async ({ page }) => {
    const html = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'monthly-statement.html'),
      'utf8',
    );

    await page.setContent(html, { waitUntil: 'networkidle' });

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });
});
