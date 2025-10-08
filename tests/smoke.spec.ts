import { test, expect } from '@playwright/test';

test.describe('Application Smoke Tests', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Property Manager/);
  });

  test('signin page loads', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.locator('h1')).toContainText(/Sign in/);
  });

  test('signup page loads', async ({ page }) => {
    await page.goto('/auth/signup');
    await expect(page.locator('h1')).toContainText(/Sign up/);
  });

  test('CSRF endpoint is accessible', async ({ request }) => {
    const response = await request.get('/api/csrf');
    expect(response.ok()).toBeTruthy();
  });

  test('protected API requires authentication', async ({ request }) => {
    const response = await request.get('/api/properties');
    expect(response.status()).toBe(401);
  });
});

