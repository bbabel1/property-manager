import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { supabaseStub } = vi.hoisted(() => {
  const leaseQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: { org_id: 'org-1' }, error: null })),
  };

  const glAccountsData = [
    { id: 1, name: 'Rent', type: 'income', buildium_gl_account_id: 5001 },
    { id: 2, name: 'Fees', type: 'income', buildium_gl_account_id: null },
  ];

  const glQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(async () => ({ data: glAccountsData, error: null })),
  };

  const bankQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn(async () => ({
      data: [{ id: 10, name: 'Operating' }],
      error: null,
    })),
  };

  return {
    supabaseStub: {
      from: (table: string) => {
        if (table === 'lease') return leaseQuery;
        if (table === 'gl_accounts') return glQuery;
        if (table === 'bank_accounts') return bankQuery;
        throw new Error(`Unexpected table: ${table}`);
      },
    },
  };
});

vi.mock('@/lib/db', () => ({
  supabaseAdmin: supabaseStub,
}));

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: vi.fn(async () => ({ supabase: supabaseStub })),
}));

import { GET } from '@/app/api/leases/[id]/financial-options/route';

describe('GET /api/leases/[id]/financial-options', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'development';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('only returns accounts that have Buildium GL mappings and reports unmapped count', async () => {
    const response = await GET(new NextRequest('http://localhost'), {
      params: Promise.resolve({ id: '12' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.accountOptions).toHaveLength(1);
    expect(body.accountOptions[0]).toMatchObject({
      id: '1',
      name: 'Rent',
      buildiumGlAccountId: 5001,
    });
    expect(body.unmappedAccountCount).toBe(1);
    expect(body.bankAccountOptions).toHaveLength(1);
  });
});
