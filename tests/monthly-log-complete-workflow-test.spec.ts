/**
 * Legacy workflow coverage for monthly logs, updated for the simplified UI.
 *
 * These tests focus on the smoke-path of creating a log and confirming
 * the detail view renders the key sections (transactions, tasks, statements).
 */

import { expect, test } from '@playwright/test';

const selectors = {
  createButton: 'button:has-text("New Monthly Log")',
  propertySelect: '#monthly-log-property-select',
  unitSelect: '#monthly-log-unit-select',
  startDateInput: '#monthly-log-start-date',
  submitButton: 'button[type="submit"]:has-text("Create log")',
};

test.describe('Monthly log creation + detail smoke test', () => {
  test('can open the create dialog and render required form controls', async ({ page }) => {
    await page.goto('/monthly-logs');
    await page.waitForLoadState('networkidle');

    const openDialogButton = page.locator(selectors.createButton);
    await expect(openDialogButton).toBeVisible();

    await openDialogButton.click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    await expect(page.locator(selectors.propertySelect)).toBeVisible();
    await expect(page.locator(selectors.unitSelect)).toBeVisible();
    await expect(page.locator(selectors.startDateInput)).toBeVisible();
  });

  test('after creation the detail layout exposes transactions, tasks, and statements', async ({ page }) => {
    await page.goto('/monthly-logs');
    await page.waitForLoadState('networkidle');

    const openDialogButton = page.locator(selectors.createButton);
    await openDialogButton.click();

    // The test dataset may be sparse; guard each interaction.
    const propertyOption = page.locator(`${selectors.propertySelect} option`).nth(1);
    if (!(await propertyOption.isVisible())) {
      test.skip(true, 'No properties available to create a monthly log');
      return;
    }

    await page.locator(selectors.propertySelect).selectOption({ index: 1 });
    const unitOption = page.locator(`${selectors.unitSelect} option`).nth(1);
    if (await unitOption.isVisible()) {
      await page.locator(selectors.unitSelect).selectOption({ index: 1 });
    }

    await page.locator(selectors.startDateInput).fill('2025-11-01');
    await page.locator(selectors.submitButton).click();

    await page.waitForURL(/\/monthly-logs\/[a-f0-9-]+/, { timeout: 15000 });

    await expect(page.locator('text=Monthly log for')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Assigned transactions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Unassigned transactions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tasks linked to this log' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Monthly Statement' })).toBeVisible();
  });
});
