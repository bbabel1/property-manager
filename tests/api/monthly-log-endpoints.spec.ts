/**
 * Integration tests for Monthly Log API endpoints
 *
 * Tests the new Phase 2 endpoints to ensure they work correctly.
 */

import { test, expect } from '@playwright/test';

test.describe('Monthly Log API Endpoints', () => {
  let monthlyLogId: string;

  test.beforeEach(async ({ page }) => {
    // Navigate to monthly logs and get a log ID from the URL
    await page.goto('/monthly-logs');
    await page.waitForLoadState('networkidle');

    // Click on the first monthly log card
    const firstLog = page.locator('[data-testid="monthly-log-card"]').first();
    if ((await firstLog.count()) > 0) {
      await firstLog.click();
      await page.waitForURL(/\/monthly-logs\/[a-f0-9-]+/);
      monthlyLogId = page.url().split('/').pop() || '';
    }
  });

  test('GET /api/monthly-logs/[logId]/financial-summary returns summary data', async ({
    request,
  }) => {
    test.skip(!monthlyLogId, 'No monthly log ID available');

    const response = await request.get(`/api/monthly-logs/${monthlyLogId}/financial-summary`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('totalCharges');
    expect(data).toHaveProperty('totalPayments');
    expect(data).toHaveProperty('totalBills');
    expect(data).toHaveProperty('escrowAmount');
    expect(data).toHaveProperty('managementFees');
    expect(data).toHaveProperty('netToOwner');
  });

  test('GET /api/monthly-logs/[logId]/payments returns payments stage data', async ({
    request,
  }) => {
    test.skip(!monthlyLogId, 'No monthly log ID available');

    const response = await request.get(`/api/monthly-logs/${monthlyLogId}/payments`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('previousLeaseBalance');
    expect(data).toHaveProperty('totalRentOwed');
    expect(data).toHaveProperty('remainingRentBalance');
    expect(data).toHaveProperty('leaseCharges');
    expect(data).toHaveProperty('leaseCredits');
    expect(data).toHaveProperty('paymentsApplied');
    expect(data).toHaveProperty('feeCharges');
  });

  test('GET /api/monthly-logs/[logId]/bills returns bills stage data', async ({ request }) => {
    test.skip(!monthlyLogId, 'No monthly log ID available');

    const response = await request.get(`/api/monthly-logs/${monthlyLogId}/bills`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('assignedBills');
    expect(data).toHaveProperty('totalBills');
    expect(Array.isArray(data.assignedBills)).toBeTruthy();
  });

  test('GET /api/monthly-logs/[logId]/escrow returns escrow data', async ({ request }) => {
    test.skip(!monthlyLogId, 'No monthly log ID available');

    const response = await request.get(`/api/monthly-logs/${monthlyLogId}/escrow`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('deposits');
    expect(data).toHaveProperty('withdrawals');
    expect(data).toHaveProperty('balance');
    expect(data).toHaveProperty('movements');
    expect(data).toHaveProperty('hasValidGLAccounts');
  });

  test('GET /api/monthly-logs/[logId]/management-fees returns fee data', async ({ request }) => {
    test.skip(!monthlyLogId, 'No monthly log ID available');

    const response = await request.get(`/api/monthly-logs/${monthlyLogId}/management-fees`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('servicePlan');
    expect(data).toHaveProperty('activeServices');
    expect(data).toHaveProperty('feeDollarAmount');
    expect(data).toHaveProperty('assignedFees');
    expect(data).toHaveProperty('totalFees');
  });

  test('GET /api/monthly-logs/[logId]/owner-draw returns draw calculation', async ({ request }) => {
    test.skip(!monthlyLogId, 'No monthly log ID available');

    const response = await request.get(`/api/monthly-logs/${monthlyLogId}/owner-draw`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('ownerDraw');
    expect(data).toHaveProperty('breakdown');
    expect(data.breakdown).toHaveProperty('payments');
    expect(data.breakdown).toHaveProperty('bills');
    expect(data.breakdown).toHaveProperty('escrow');
  });

  test('POST /api/monthly-logs/[logId]/reconcile triggers balance reconciliation', async ({
    request,
  }) => {
    test.skip(!monthlyLogId, 'No monthly log ID available');

    const response = await request.post(`/api/monthly-logs/${monthlyLogId}/reconcile`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(data.success).toBeTruthy();
  });
});
