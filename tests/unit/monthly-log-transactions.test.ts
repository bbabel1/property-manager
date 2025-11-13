import { describe, expect, it } from 'vitest';

import { __test__ } from '@/server/monthly-logs/transactions';

const { normalizeTransactionRow, applyEscrowOverride } = __test__;

const baseRow = {
  memo: null,
  date: '2025-11-01',
  transaction_type: 'GeneralJournalEntry',
  lease_id: null,
  monthly_log_id: null,
  reference_number: null,
} satisfies Partial<Record<string, unknown>>;

describe('normalizeTransactionRow', () => {
  it('prefers effective_amount when provided', () => {
    const row = {
      ...baseRow,
      id: 'tx-1',
      total_amount: 0,
      effective_amount: 42,
      transaction_lines: [],
    };

    const result = normalizeTransactionRow(row as any, { unitId: null });
    expect(result.total_amount).toBe(42);
  });

  it('derives negative amount for deposit credit lines with matching unit', () => {
    const row = {
      ...baseRow,
      id: 'tx-2',
      total_amount: 0,
      transaction_lines: [
        {
          amount: 45,
          posting_type: 'Credit',
          unit_id: 'unit-123',
          created_at: '2025-11-01T00:00:00Z',
          gl_accounts: {
            name: 'Tax Escrow',
            gl_account_category: { category: 'deposit' },
          },
        },
        {
          amount: 45,
          posting_type: 'Debit',
          unit_id: null,
          created_at: '2025-11-01T00:00:01Z',
          gl_accounts: {
            name: 'Owner Draw',
            gl_account_category: { category: 'owner_draw' },
          },
        },
      ],
    };

    const result = normalizeTransactionRow(row as any, { unitId: 'unit-123' });
    expect(result.total_amount).toBe(-45);
    expect(result.account_name).toBe('Tax Escrow');
  });

  it('returns positive amount for deposit debit lines', () => {
    const row = {
      ...baseRow,
      id: 'tx-2b',
      total_amount: 0,
      transaction_lines: [
        {
          amount: 45,
          posting_type: 'Debit',
          unit_id: 'unit-123',
          created_at: '2025-11-01T00:00:00Z',
          gl_accounts: {
            name: 'Tax Escrow',
            gl_account_category: { category: 'deposit' },
          },
        },
        {
          amount: 45,
          posting_type: 'Credit',
          unit_id: null,
          created_at: '2025-11-01T00:00:01Z',
          gl_accounts: {
            name: 'Owner Draw',
            gl_account_category: { category: 'owner_draw' },
          },
        },
      ],
    };

    const result = normalizeTransactionRow(row as any, { unitId: 'unit-123' });
    expect(result.total_amount).toBe(45);
    expect(result.account_name).toBe('Tax Escrow');
  });

  it('respects tax escrow name even without deposit category', () => {
    const row = {
      ...baseRow,
      id: 'tx-2c',
      total_amount: 0,
      transaction_lines: [
        {
          amount: 30,
          posting_type: 'Credit',
          unit_id: 'unit-123',
          created_at: '2025-11-01T00:00:00Z',
          gl_accounts: {
            name: 'Tax Escrow',
            gl_account_category: null,
          },
        },
      ],
    };

    const result = normalizeTransactionRow(row as any, { unitId: 'unit-123' });
    expect(result.total_amount).toBe(-30);
  });

  it('falls back to first line when no unit match', () => {
    const row = {
      ...baseRow,
      id: 'tx-3',
      total_amount: 0,
      transaction_lines: [
        {
          amount: 18,
          posting_type: 'Debit',
          unit_id: null,
          created_at: '2025-11-01T00:00:00Z',
          gl_accounts: {
            name: 'Escrow Adjustment',
            gl_account_category: { category: 'deposit' },
          },
        },
        {
          amount: 18,
          posting_type: 'Credit',
          unit_id: null,
          created_at: '2025-11-01T00:00:01Z',
          gl_accounts: {
            name: 'Offset',
            gl_account_category: { category: 'income' },
          },
        },
      ],
    };

    const result = normalizeTransactionRow(row as any, { unitId: 'unit-999' });
    expect(result.total_amount).toBe(18);
    expect(result.account_name).toBe('Escrow Adjustment');
  });
});

describe('applyEscrowOverride', () => {
  it('overrides escrow and derived totals based on tax escrow transactions', () => {
    const transactions = [
      {
        id: 't1',
        total_amount: -30,
        memo: null,
        date: '2025-11-01',
        transaction_type: 'GeneralJournalEntry',
        lease_id: null,
        monthly_log_id: null,
        reference_number: null,
        account_name: 'Property Tax Escrow',
      },
      {
        id: 't2',
        total_amount: 5,
        memo: null,
        date: '2025-11-02',
        transaction_type: 'Charge',
        lease_id: null,
        monthly_log_id: null,
        reference_number: null,
        account_name: 'Other Income',
      },
    ];

    const summary = applyEscrowOverride(transactions, {
      totalCharges: 0,
      totalCredits: 0,
      totalPayments: 5,
      totalBills: 0,
      escrowAmount: 0,
      managementFees: 0,
      netToOwner: 0,
      balance: 0,
      previousBalance: 0,
      ownerDraw: 0,
    });

    expect(summary?.escrowAmount).toBe(-30);
    expect(summary?.ownerDraw).toBe(0);
    expect(summary?.netToOwner).toBe(-25);
  });

  it('uses owner draw transactions when present', () => {
    const transactions = [
      {
        id: 't1',
        total_amount: -30,
        memo: null,
        date: '2025-11-01',
        transaction_type: 'GeneralJournalEntry',
        lease_id: null,
        monthly_log_id: null,
        reference_number: null,
        account_name: 'Property Tax Escrow',
      },
      {
        id: 't2',
        total_amount: 30,
        memo: null,
        date: '2025-11-01',
        transaction_type: 'GeneralJournalEntry',
        lease_id: null,
        monthly_log_id: null,
        reference_number: null,
        account_name: 'Owner Draw',
      },
    ];

    const summary = applyEscrowOverride(transactions, {
      totalCharges: 0,
      totalCredits: 0,
      totalPayments: 100,
      totalBills: 0,
      escrowAmount: 0,
      managementFees: 0,
      netToOwner: 0,
      balance: 0,
      previousBalance: 0,
      ownerDraw: 0,
    });

    expect(summary?.escrowAmount).toBe(-30);
    expect(summary?.ownerDraw).toBe(30);
    expect(summary?.netToOwner).toBe(40);
  });
});

