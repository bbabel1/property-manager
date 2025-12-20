import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Monthly statement journey (fixture-based)', () => {
  test('renders key totals and headings', async ({ page }) => {
    const html = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'monthly-statement.html'),
      'utf8',
    );
    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Financial Summary')).toBeVisible();
    await expect(page.getByText('Total Income')).toBeVisible();
    await expect(page.getByText('Total Expenses')).toBeVisible();
    await expect(page.getByText('Ending Balance')).toBeVisible();

    await expect(page.getByRole('cell', { name: '$2,000.00' }).first()).toBeVisible();
    await expect(page.getByRole('cell', { name: '-$750.00' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '-$1,250.00' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '$0.00' }).first()).toBeVisible();
  });
});
