import { test, expect } from '@playwright/test';
import { getTestUserToken } from '../helpers/auth';

test.describe('Files List API', () => {
  test('GET /api/files/list returns 403 when user lacks org membership', async ({ request }) => {
    const accessToken = await getTestUserToken();

    const response = await request.get('/api/files/list?limit=1', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-org-id': '00000000-0000-0000-0000-000000000000',
      },
    });

    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  test('GET /api/files/list returns 200 for members of the organization', async ({ request }) => {
    const accessToken = await getTestUserToken();

    const response = await request.get('/api/files/list?limit=1', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.pagination).toBeDefined();
  });
});
