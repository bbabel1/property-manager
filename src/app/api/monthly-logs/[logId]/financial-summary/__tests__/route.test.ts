import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: vi.fn().mockResolvedValue({ supabase: 'mock-supabase' }),
}));

class QueryBuilder {
  constructor(private table: string) {}
  select() {
    return this;
  }
  eq() {
    return this;
  }
  maybeSingle() {
    return Promise.resolve({ data: null, error: null });
  }
}

vi.mock('@/lib/db', () => ({
  supabaseAdmin: {
    from: (table: string) => new QueryBuilder(table),
  },
  supabase: {
    from: (table: string) => new QueryBuilder(table),
  },
}));

vi.mock('@/server/monthly-logs/transactions', () => ({
  loadAssignedTransactionsBundle: vi.fn().mockResolvedValue({
    summary: { netToOwner: 1000, totalPayments: 2000 },
  }),
}));

const { GET } = await import('../route');

describe('GET /api/monthly-logs/[logId]/financial-summary', () => {
  it('returns summary when auth succeeds', async () => {
    const req = new NextRequest('http://localhost/api/monthly-logs/log-1/financial-summary');
    const res = await GET(req, { params: Promise.resolve({ logId: 'log-1' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ netToOwner: 1000, totalPayments: 2000 });
  });

  it('returns 401 when unauthenticated', async () => {
    const guards = await import('@/lib/auth/guards');
    vi.mocked(guards.requireAuth).mockRejectedValueOnce(new Error('UNAUTHENTICATED'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const req = new NextRequest('http://localhost/api/monthly-logs/log-1/financial-summary');
    const res = await GET(req, { params: Promise.resolve({ logId: 'log-1' }) });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });
});
