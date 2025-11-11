import { describe, expect, it, beforeEach, vi } from 'vitest';

const {
  mockCreateInBuildiumAndDB,
  mockFetchLeaseContextById,
  mockFetchBuildiumGlAccountMap,
  mockBuildLinesFromAllocations,
  mockFetchTransactionWithLines,
  mockFetchBankAccountBuildiumId,
} = vi.hoisted(() => {
  const createInBuildiumAndDB = vi.fn(async (_leaseId: number, payload: any) => ({
    localId: null,
    buildium: {
      Id: 999,
      TransactionType: payload?.TransactionType ?? 'Payment',
      TransactionTypeEnum: payload?.TransactionType ?? 'Payment',
      TotalAmount: payload?.Amount ?? 0,
      TransactionDate: payload?.TransactionDate ?? '2024-01-01',
      Memo: payload?.Memo ?? null,
    },
  }));

  return {
    mockCreateInBuildiumAndDB: createInBuildiumAndDB,
    mockFetchLeaseContextById: vi.fn().mockResolvedValue({
      leaseId: 321,
      buildiumLeaseId: 654,
    }),
    mockFetchBuildiumGlAccountMap: vi.fn().mockResolvedValue(new Map([['acct', 5001]])),
    mockBuildLinesFromAllocations: vi.fn().mockReturnValue([{ GLAccountId: 5001, Amount: 100 }]),
    mockFetchTransactionWithLines: vi.fn().mockResolvedValue(null),
    mockFetchBankAccountBuildiumId: vi.fn().mockResolvedValue(777),
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
    updateInBuildiumAndDB: vi.fn(),
    getFromBuildium: vi.fn(),
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
    buildLinesFromAllocations: mockBuildLinesFromAllocations,
    fetchTransactionWithLines: mockFetchTransactionWithLines,
    fetchBankAccountBuildiumId: mockFetchBankAccountBuildiumId,
  };
});

import { POST as paymentsPost } from '@/app/api/leases/[id]/payments/route';
import { POST as refundsPost } from '@/app/api/leases/[id]/refunds/route';
import { LeaseTransactionService } from '@/lib/lease-transaction-service';

describe('lease transaction APIs propagate PayeeTenantId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchLeaseContextById.mockResolvedValue({
      leaseId: 321,
      buildiumLeaseId: 654,
    });
    mockFetchBankAccountBuildiumId.mockResolvedValue(777);
  });

  it('passes PayeeTenantId when creating a payment', async () => {
    const request = new Request('http://localhost/api/leases/1/payments', {
      method: 'POST',
      body: JSON.stringify({
        date: '2024-10-01',
        amount: 120,
        payment_method: 'Check',
        resident_id: '555',
        memo: 'Overlay payment',
        allocations: [{ account_id: 'acct', amount: 120 }],
        send_email: false,
        print_receipt: false,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await paymentsPost(request, { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(201);
    expect(LeaseTransactionService.createInBuildiumAndDB).toHaveBeenCalledWith(
      654,
      expect.objectContaining({ PayeeTenantId: 555 }),
    );
  });

  it('rejects payments when the selected tenant lacks a Buildium ID', async () => {
    const request = new Request('http://localhost/api/leases/1/payments', {
      method: 'POST',
      body: JSON.stringify({
        date: '2024-10-01',
        amount: 120,
        payment_method: 'Check',
        resident_id: 'tenant-uuid',
        memo: 'Overlay payment',
        allocations: [{ account_id: 'acct', amount: 120 }],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await paymentsPost(request, { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toMatch(/Buildium tenant ID/);
    expect(LeaseTransactionService.createInBuildiumAndDB).not.toHaveBeenCalled();
  });

  it('passes PayeeTenantId when issuing a refund', async () => {
    const request = new Request('http://localhost/api/leases/1/refunds', {
      method: 'POST',
      body: JSON.stringify({
        date: '2024-10-01',
        bank_account_id: 'bank-1',
        payment_method: 'check',
        party_id: '7777',
        amount: 50,
        address_option: 'current',
        allocations: [{ account_id: 'acct', amount: 50 }],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await refundsPost(request, { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(201);
    expect(LeaseTransactionService.createInBuildiumAndDB).toHaveBeenCalledWith(
      654,
      expect.objectContaining({ PayeeTenantId: 7777 }),
    );
  });

  it('rejects refunds when the selected tenant lacks a Buildium ID', async () => {
    const request = new Request('http://localhost/api/leases/1/refunds', {
      method: 'POST',
      body: JSON.stringify({
        date: '2024-10-01',
        bank_account_id: 'bank-1',
        payment_method: 'check',
        party_id: 'tenant-uuid',
        amount: 50,
        address_option: 'current',
        allocations: [{ account_id: 'acct', amount: 50 }],
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await refundsPost(request, { params: Promise.resolve({ id: '1' }) });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toMatch(/Buildium tenant ID/);
    expect(LeaseTransactionService.createInBuildiumAndDB).not.toHaveBeenCalled();
  });
});
