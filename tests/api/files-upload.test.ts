import { test, expect } from '@playwright/test';
import { getTestUserToken } from '../helpers/auth';

const NEAR_LIMIT_BYTES = 24 * 1024 * 1024; // ~24 MB
const OVER_LIMIT_BYTES = 26 * 1024 * 1024; // ~26 MB

test.describe('Files Upload API', () => {
  let accessToken: string;

  test.beforeAll(async () => {
    accessToken = await getTestUserToken();
  });

  test('accepts multipart uploads near the size limit', async ({ request }) => {
    const buffer = Buffer.alloc(NEAR_LIMIT_BYTES, 0);

    const response = await request.post('/api/files/upload', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      multipart: {
        file: {
          name: 'near-limit.pdf',
          mimeType: 'application/pdf',
          buffer,
        },
        entityType: 'lease',
        entityId: 'test-lease',
        fileName: 'near-limit.pdf',
        category: 'Lease',
        isPrivate: 'true',
      },
    });

    expect(response.status()).toBe(201);
    const payload = await response.json();
    expect(payload?.file).toBeDefined();
    expect(payload?.file?.file_name).toBe('near-limit.pdf');
  });

  test('rejects uploads that exceed the size limit', async ({ request }) => {
    const buffer = Buffer.alloc(OVER_LIMIT_BYTES, 0);

    const response = await request.post('/api/files/upload', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      multipart: {
        file: {
          name: 'too-big.pdf',
          mimeType: 'application/pdf',
          buffer,
        },
        entityType: 'lease',
        entityId: 'test-lease',
        fileName: 'too-big.pdf',
        category: 'Lease',
        isPrivate: 'true',
      },
    });

    expect(response.status()).toBe(413);
    const payload = await response.json();
    expect(payload?.error).toContain('25 MB');
  });
});

