import { describe, expect, it, vi } from 'vitest';
import type { TypedSupabaseClient } from '@/lib/db';

// Stub Next.js server-only module used in the service
vi.mock('server-only', () => ({}));

// Mock monthly log calculations to avoid DB calls
vi.mock('@/lib/monthly-log-calculations', () => ({
  getOwnerDrawSummary: vi.fn().mockResolvedValue({ total: 0, transactions: [] }),
  calculateFinancialSummary: vi.fn().mockResolvedValue({
    totalCharges: 0,
    totalCredits: 0,
    totalPayments: 0,
    totalBills: 0,
    escrowAmount: 0,
    managementFees: 0,
    netToOwner: 0,
    ownerDraw: 0,
    balance: 0,
    previousBalance: 0,
  }),
}));

// Minimal Supabase client stub that respects eq filters on nested paths
vi.mock('@/lib/db', () => {
  type StatementProperty = {
    name: string;
    address_line1: string;
    city: string;
    state: string;
    postal_code: string;
  };

  type StatementUnit = {
    unit_number: string;
    unit_name: string | null;
  };

  type MonthlyLogRowStub = {
    id: string;
    period_start: string;
    property_id: string;
    unit_id: string;
    tenant_id: string | null;
    charges_amount: number;
    payments_amount: number;
    bills_amount: number;
    escrow_amount: number;
    management_fees_amount: number;
    previous_lease_balance: number;
    properties: StatementProperty;
    units: StatementUnit;
  };

  type TransactionLineRowStub = {
    id: string;
    date: string;
    memo: string;
    amount: number;
    posting_type: 'Credit' | 'Debit' | string;
    transactions: {
      id: string;
      date: string;
      transaction_type: string;
      monthly_log_id: string;
      memo: string;
    };
    gl_accounts: {
      name: string;
      default_account_name: string;
      type: string;
      gl_account_category: { category: string };
    };
  };

  type OwnershipContactStub = {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    company_name?: string | null;
  };

  type OwnershipRowStub = {
    owners?: {
      company_name?: string | null;
      contacts?: OwnershipContactStub | OwnershipContactStub[] | null;
    } | null;
  };

  type TableData = {
    monthly_logs: MonthlyLogRowStub[];
    transaction_lines: TransactionLineRowStub[];
    ownerships: OwnershipRowStub[];
  };

  const tableData: TableData = {
    monthly_logs: [
      {
        id: 'log-1',
        period_start: '2025-10-01',
        property_id: 'prop-1',
        unit_id: 'unit-1',
        tenant_id: null,
        charges_amount: 0,
        payments_amount: 0,
        bills_amount: 0,
        escrow_amount: 0,
        management_fees_amount: 0,
        previous_lease_balance: 0,
        properties: {
          name: 'Test Property',
          address_line1: '123 Main',
          city: 'City',
          state: 'ST',
          postal_code: '12345',
        },
        units: {
          unit_number: '1A',
          unit_name: null,
        },
      },
    ],
    transaction_lines: [
      {
        id: 'tl-assigned-reserve',
        date: '2025-10-05',
        memo: 'Assigned reserve deposit',
        amount: 100,
        posting_type: 'Credit',
        transactions: {
          id: 'tx-assigned',
          date: '2025-10-05',
          transaction_type: 'Payment',
          monthly_log_id: 'log-1',
          memo: 'Assigned reserve deposit',
        },
        gl_accounts: {
          name: 'Reserve',
          default_account_name: 'Reserve',
          type: 'liability',
          gl_account_category: { category: 'deposit' },
        },
      },
      {
        id: 'tl-unassigned',
        date: '2025-10-06',
        memo: 'Unassigned reserve deposit',
        amount: 50,
        posting_type: 'Credit',
        transactions: {
          id: 'tx-unassigned',
          date: '2025-10-06',
          transaction_type: 'Payment',
          monthly_log_id: 'log-2',
          memo: 'Unassigned reserve deposit',
        },
        gl_accounts: {
          name: 'Reserve',
          default_account_name: 'Reserve',
          type: 'liability',
          gl_account_category: { category: 'deposit' },
        },
      },
      {
        id: 'tl-income',
        date: '2025-10-07',
        memo: 'Rent income',
        amount: 500,
        posting_type: 'Credit',
        transactions: {
          id: 'tx-income',
          date: '2025-10-07',
          transaction_type: 'Payment',
          monthly_log_id: 'log-1',
          memo: 'Rent income',
        },
        gl_accounts: {
          name: 'Rent Income',
          default_account_name: 'Rent Income',
          type: 'income',
          gl_account_category: { category: 'income' },
        },
      },
    ],
    ownerships: [],
  };

  const getValue = <TName extends keyof TableData>(
    row: TableData[TName][number],
    path: string,
  ) => {
    return path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in acc) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, row);
  };

  type Filter = { column: string; value: unknown; type: 'eq' | 'in' };

  class QueryBuilder<TName extends keyof TableData> {
    private table: TName;
    private filters: Filter[] = [];

    constructor(table: TName) {
      this.table = table;
    }

    select(_columns?: string) {
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value, type: 'eq' });
      return this;
    }

    in(column: string, value: unknown[]) {
      this.filters.push({ column, value, type: 'in' });
      return this;
    }

    order(_column?: string, _options?: { ascending?: boolean }) {
      const data = this.applyFilters();
      return Promise.resolve({ data, error: null as null });
    }

    single() {
      const data = (this.applyFilters()[0] ?? null) as TableData[TName][number] | null;
      return Promise.resolve({ data, error: null as null });
    }

    maybeSingle() {
      const data = (this.applyFilters()[0] ?? null) as TableData[TName][number] | null;
      return Promise.resolve({ data, error: null as null });
    }

    private applyFilters(): TableData[TName] {
      const rows = (tableData[this.table] ?? []) as TableData[TName];
      return rows.filter((row) =>
        this.filters.every((filter) => {
          const value = getValue(row, filter.column);
          if (filter.type === 'eq') {
            return value === filter.value;
          }
          if (filter.type === 'in') {
            return Array.isArray(filter.value) && filter.value.includes(value);
          }
          return true;
        }),
      ) as unknown as TableData[TName];
    }
  }

  const supabaseAdmin = {
    from: <TName extends keyof TableData>(table: TName) => new QueryBuilder<TName>(table),
  } as unknown as TypedSupabaseClient;

  return { supabaseAdmin };
});

import { fetchMonthlyStatementData } from '@/lib/monthly-statement-service';

describe('fetchMonthlyStatementData', () => {
  it('excludes unassigned or out-of-log deposit lines from accountTotals', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await fetchMonthlyStatementData('log-1');

    expect(result.success).toBe(true);
    const totals = result.data?.accountTotals ?? [];

    const reserve = totals.find((item) => item.label === 'Reserve');
    const propertyTaxEscrow = totals.find((item) => item.label === 'Property Tax Escrow');
    const securityDeposit = totals.find((item) => item.label === 'Tenant Security Deposit');

    expect(reserve?.balance).toBe(100);
    expect(propertyTaxEscrow?.balance).toBe(0);
    expect(securityDeposit?.balance).toBe(0);

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
