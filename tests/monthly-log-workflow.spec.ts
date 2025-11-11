/**
 * Monthly Log UI regression tests.
 *
 * Cover the primary flows in the refreshed experience: list filtering,
 * transactions management, tasks context, and statement utilities.
 */

import { test, expect } from '@playwright/test';

test.describe('Monthly Logs – refreshed experience', () => {
  test('list view exposes status tabs and tabular logs', async ({ page }) => {
    await page.goto('/monthly-logs');
    await page.waitForLoadState('networkidle');

    // Tabs should reflect the simplified Completed / Incomplete split
    await expect(page.getByRole('tab', { name: /Incomplete/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Complete/ })).toBeVisible();

    // Table should render using the shared table pattern
    await expect(page.getByRole('columnheader', { name: 'Unit' })).toBeVisible();

    // Table rows should render the logs (if any exist for the seeded data set)
    const firstRow = page.locator('[data-testid="monthly-log-card"]').first();
    if ((await firstRow.count()) > 0) {
      await expect(firstRow.locator('td').first()).toBeVisible();
    }
  });

  test('detail view highlights transactions, tasks, and statement tools', async ({ page }) => {
    await page.goto('/monthly-logs');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('[data-testid="monthly-log-card"]').first();
    if ((await firstRow.count()) === 0) {
      test.skip(true, 'No monthly logs available in the test dataset');
      return;
    }

    await firstRow.click();
    await page.waitForURL(/\/monthly-logs\/[a-f0-9-]+/);

    await test.step('Header + summary', async () => {
      await expect(page.locator('text=Monthly log for')).toBeVisible();
      await expect(
        page.locator('button', { hasText: /Mark monthly log complete|Reopen monthly log/ }),
      ).toBeVisible();
      await expect(page.locator('text=Financial Summary')).toBeVisible();
      await expect(page.locator('text=Net to Owner')).toBeVisible();
    });

    await test.step('Assigned and unassigned transactions sections', async () => {
      await expect(page.getByRole('heading', { name: 'Assigned transactions' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Unassigned transactions' })).toBeVisible();
      await expect(page.getByPlaceholder('Search memo or reference')).toBeVisible();
      await expect(page.getByRole('combobox', { name: 'All types' })).toBeVisible();
    });

    await test.step('Tasks panel summarises linked work', async () => {
      await expect(page.getByRole('heading', { name: 'Tasks linked to this log' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open tasks workspace' })).toBeVisible();
    });

    await test.step('Statement tooling remains accessible', async () => {
      await expect(page.getByRole('heading', { name: 'Monthly Statement' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Preview HTML' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Generate PDF' })).toBeVisible();
    });
  });

  test('Add transaction modal keeps long forms scrollable', async ({ page }) => {
    await page.goto('/monthly-logs');
    await page.waitForLoadState('networkidle');

    const firstRow = page.locator('[data-testid="monthly-log-card"]').first();
    if ((await firstRow.count()) === 0) {
      test.skip(true, 'No monthly logs available in the test dataset');
      return;
    }

    await firstRow.click();
    await page.waitForURL(/\/monthly-logs\/[a-f0-9-]+/);

    const addTransactionButton = page.getByRole('button', { name: 'Add transaction' });
    if (!(await addTransactionButton.isEnabled())) {
      test.skip(true, 'Seed data does not enable Add transaction');
      return;
    }

    await addTransactionButton.click();

    const dialog = page.getByRole('dialog', { name: 'Add lease transaction' });
    await expect(dialog).toBeVisible();

    const dialogContent = dialog.locator('[data-slot="dialog-content"]');
    const isScrollable = await dialogContent.evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }
      return element.scrollHeight > element.clientHeight;
    });

    expect(isScrollable).toBeTruthy();

    const saveButton = dialog.getByRole('button', { name: /Save payment/i });
    await saveButton.scrollIntoViewIfNeeded();
    await expect(saveButton).toBeVisible();
  });
});
