import { test, expect } from '@playwright/test';
import { getTestUserToken, getTestUserCredentials } from './helpers/auth';

test.describe('Application Smoke Tests', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Ora Property Management/);
  });

  test('signin page loads', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.locator('h4')).toContainText(/Sign in/);
  });

  test('signup page redirects when authenticated', async ({ page }) => {
    const { email, password } = getTestUserCredentials();

    await page.goto('/auth/signin');

    const passwordTab = page.getByRole('button', { name: 'Password' }).first();
    await passwordTab.waitFor({ state: 'visible' });
    await passwordTab.click();

    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(password);
    await Promise.all([
      page.waitForURL(/dashboard|properties|monthly-logs/),
      page.getByRole('button', { name: /sign in/i }).click(),
    ]);

    // Confirm login succeeded
    await expect(page).toHaveURL(/dashboard|properties|monthly-logs/);

    await page.goto('/auth/signup');
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.locator('h1')).toContainText(/Dashboard/);
  });

  test('CSRF endpoint is accessible', async ({ request }) => {
    const response = await request.get('/api/csrf');
    expect(response.ok()).toBeTruthy();
  });

  test('protected API allows access in test mode', async ({ request }) => {
    const token = await getTestUserToken();
    const response = await request.get('/api/properties', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    // Authenticated request should return 200 instead of 401
    expect(response.status()).toBe(200);
  });
});
