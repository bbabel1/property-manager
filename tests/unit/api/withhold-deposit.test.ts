import { describe, expect, it, beforeEach, vi } from 'vitest';

const {
  mockCreateInBuildiumAndDB,
  mockFetchLeaseContextById,
  mockFetchBuildiumGlAccountMap,
} = vi.hoisted(() => {
  const createInBuildiumAndDB = vi.fn(async () => ({
    localId: null,
    buildium: {
      Id: 123,
      TransactionType: 'ApplyDeposit',
      TransactionTypeEnum: 'ApplyDeposit',
      TotalAmount: 150,
      TransactionDate: '2024-02-15',
    },
  }));

  return {
    mockCreateInBuildiumAndDB: createInBuildiumAndDB,
    mockFetchLeaseContextById: vi.fn().mockResolvedValue({
      leaseId: 42,
      buildiumLeaseId: 555,
    }),
    mockFetchBuildiumGlAccountMap: vi.fn(async () => new Map([
      ['deposit', 9001],
      ['rent', 4000],
    ])),
  };
});


vi.mock('@/lib/auth/guards', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/supabase-client', () => ({
  hasSupabaseAdmin: () => true,
}));

vi.mock('@/lib/lease-transaction-service', () => ({
  LeaseTransactionService: {
    createInBuildiumAndDB: mockCreateInBuildiumAndDB,
  },
}));

vi.mock('@/lib/lease-transaction-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/lease-transaction-helpers')>(
    '@/lib/lease-transaction-helpers',
  );
  return {
    ...actual,
    fetchLeaseContextById: mockFetchLeaseContextById,
    fetchBuildiumGlAccountMap: mockFetchBuildiumGlAccountMap,
  };
});

import { POST } from '@/app/api/leases/[id]/withheld-deposits/route';
import { NextResponse } from 'next/server';

describe('POST /api/leases/[id]/withheld-deposits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBuildiumGlAccountMap.mockResolvedValue(
      new Map([
        ['deposit', 9001],
        ['rent', 4000],
      ]),
    );
  });

  it('includes DepositAccountId in the Buildium payload', async () => {
    const request = new Request('http://localhost/api/leases/1/withheld-deposits', {
      method: 'POST',
      body: JSON.stringify({
        date: '2024-02-15',
        deposit_account_id: 'deposit',
        memo: 'Applying deposit',
        allocations: [{ account_id: 'rent', amount: 150 }],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = (await POST(request, { params: Promise.resolve({ id: '1' }) })) as NextResponse;
    expect(response.status).toBe(201);
    expect(mockCreateInBuildiumAndDB).toHaveBeenCalledWith(
      555,
      expect.objectContaining({
        TransactionType: 'ApplyDeposit',
        Lines: expect.arrayContaining([
          expect.objectContaining({ GLAccountId: 4000 }),
          expect.objectContaining({ GLAccountId: 9001, Amount: -150 }),
        ]),
        DepositAccountId: 9001,
      }),
    );
  });
});
