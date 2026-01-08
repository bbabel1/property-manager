import { describe, it, expect, vi, beforeEach } from 'vitest';

const apiState = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({
  requireRole: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/server/bills/pay-bills-by-check', () => ({
  createCheckPaymentsForBills: apiState.createMock,
}));

describe('POST /api/bills/payments/by-check', () => {
  beforeEach(() => {
    vi.resetModules();
    apiState.createMock.mockReset();
    apiState.createMock.mockResolvedValue([
      { billId: 'bill-1', success: true },
    ]);
  });

  async function loadRoute() {
    const route = await import('@/app/api/bills/payments/by-check/route');
    return { POST: route.POST, createMock: apiState.createMock };
  }

  it('returns 400 when no items provided', async () => {
    const { POST } = await loadRoute();

    const res = await POST(
      new Request('http://localhost/api/bills/payments/by-check', {
        method: 'POST',
        body: JSON.stringify({ groups: [] }),
      }) as any,
    );
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/no payment items/i);
  });

  it('flattens groups and returns results from domain function', async () => {
    const { POST, createMock } = await loadRoute();
    createMock.mockResolvedValueOnce([
      { billId: 'bill-1', success: true },
      { billId: 'bill-2', success: false, error: 'Missing Buildium ID' },
    ]);

    const payload = {
      groups: [
        {
          bankGlAccountId: 'bank-1',
          items: [
            {
              billId: 'bill-1',
              bankGlAccountId: null,
              payDate: '2025-01-15',
              amount: 50,
            },
            {
              billId: 'bill-2',
              bankGlAccountId: 'bank-1',
              payDate: '2025-01-15',
              amount: 75,
            },
          ],
        },
      ],
    };

    const res = await POST(
      new Request('http://localhost/api/bills/payments/by-check', {
        method: 'POST',
        body: JSON.stringify(payload),
      }) as any,
    );

    const body = (await res.json()) as {
      success?: boolean;
      results?: { billId: string; success: boolean; error?: string }[];
    };

    // Domain function called with flattened items.
    expect(createMock).toHaveBeenCalledTimes(1);
    const passedItems = createMock.mock.calls[0][0];
    expect(passedItems).toHaveLength(2);
    expect(passedItems[0].billId).toBe('bill-1');
    expect(passedItems[0].bankGlAccountId).toBe('bank-1'); // inherited from group

    expect(res.status).toBe(200);
    expect(body.results).toEqual([
      { billId: 'bill-1', success: true },
      { billId: 'bill-2', success: false, error: 'Missing Buildium ID' },
    ]);
  });

  it('returns 400 when all payments fail', async () => {
    const { POST, createMock } = await loadRoute();
    createMock.mockResolvedValueOnce([
      { billId: 'bill-1', success: false, error: 'Insufficient remaining amount' },
    ]);

    const res = await POST(
      new Request('http://localhost/api/bills/payments/by-check', {
        method: 'POST',
        body: JSON.stringify({
          groups: [
            {
              bankGlAccountId: 'bank-1',
              items: [
                {
                  billId: 'bill-1',
                  bankGlAccountId: 'bank-1',
                  payDate: '2025-01-15',
                  amount: 500,
                },
              ],
            },
          ],
        }),
      }) as any,
    );

    const body = (await res.json()) as {
      success?: boolean;
      results?: { billId: string; success: boolean; error?: string }[];
    };

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.results?.[0].error).toMatch(/insufficient/i);
  });
});
