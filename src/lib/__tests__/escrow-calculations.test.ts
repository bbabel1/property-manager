import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createEscrowTransaction, getEscrowBalance, getEscrowMovements } from '../escrow-calculations';
import type { TypedSupabaseClient } from '@/lib/db';

type EscrowTableData = {
  gl_accounts: Array<{ id: string; gl_account_category: { category: string }; is_bank_account?: boolean }>;
  transactions: Array<{ id: string; bank_gl_account_id?: string | null }>;
  transaction_lines: Array<{
    id: string;
    unit_id: string;
    property_id?: string | null;
    transaction_id?: string | null;
    gl_account_id: string;
    date: string;
    memo?: string | null;
    amount: number | null;
    posting_type: 'Credit' | 'Debit';
  }>;
};

vi.mock('@/lib/db', () => {
  type Primitive = string | number | boolean | null;
  type FilterValue = Primitive | Primitive[];
  type Row = Record<string, unknown>;
  type Filter = { column: string; value: FilterValue; type: 'eq' | 'lte' | 'gte' | 'in' };

  const isScalar = (value: unknown): value is Primitive =>
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null;

  const isComparable = (value: unknown): value is string | number =>
    typeof value === 'string' || typeof value === 'number';

  const getValue = (row: Row, path: string): unknown =>
    path.split('.').reduce<unknown>((acc, key) => {
      if (acc === null || acc === undefined) return undefined;
      if (typeof acc !== 'object') return undefined;
      return (acc as Record<string, unknown>)[key];
    }, row);

  const tableData: EscrowTableData = {
    gl_accounts: [{ id: 'acc-escrow', gl_account_category: { category: 'deposit' } }],
    transactions: [],
    transaction_lines: [],
  };

  class QueryBuilder<T extends Row = Row> implements PromiseLike<{ data: T[]; error: null }> {
    private filters: Filter[] = [];
    private orderBy?: { column: string; ascending: boolean };
    private operation: 'select' | 'insert' | 'delete' = 'select';
    private insertRows: Row[] | null = null;

    constructor(private table: keyof EscrowTableData | string) {}

    select(_columns?: string) {
      return this;
    }

    insert(payload: Row | Row[]) {
      this.operation = 'insert';
      this.insertRows = Array.isArray(payload) ? payload : [payload];
      return this;
    }

    delete() {
      this.operation = 'delete';
      return this;
    }

    eq(column: string, value: Primitive) {
      this.filters.push({ column, value, type: 'eq' });
      return this;
    }

    lte(column: string, value: Primitive) {
      this.filters.push({ column, value, type: 'lte' });
      return this;
    }

    gte(column: string, value: Primitive) {
      this.filters.push({ column, value, type: 'gte' });
      return this;
    }

    in(column: string, value: Primitive[]) {
      this.filters.push({ column, value, type: 'in' });
      return this;
    }

    order(column: string, options: { ascending?: boolean } = {}) {
      this.orderBy = { column, ascending: options.ascending ?? true };
      return this;
    }

    maybeSingle(): Promise<{ data: T | null; error: null }> {
      const data = (this.applyFilters()[0] as T | undefined) ?? null;
      return Promise.resolve({ data, error: null });
    }

    single(): Promise<{ data: T | null; error: null }> {
      const data = (this.applyFilters()[0] as T | undefined) ?? null;
      return Promise.resolve({ data, error: null });
    }

    private applyFilters(): T[] {
      if (this.operation === 'insert') {
        const nextRows = ((this.insertRows ?? []).map((row) => ({
          id:
            typeof (row as { id?: unknown }).id === 'string'
              ? (row as { id: string }).id
              : `${this.table}-${Math.random().toString(16).slice(2)}`,
          ...row,
        })) as unknown) as T[];
        (tableData as Record<string, Row[]>)[this.table] = [
          ...(((tableData as Record<string, Row[]>)[this.table] ?? []) as Row[]),
          ...nextRows,
        ];
        this.insertRows = null;
        this.operation = 'select';
        return nextRows;
      }

      const rows = [...(((tableData as Record<string, Row[]>)[this.table] ?? []) as T[])];

      const filtered = rows.filter((row) =>
        this.filters.every((filter) => {
          const value = getValue(row, filter.column);
          if (filter.type === 'eq') {
            return !Array.isArray(filter.value) && isScalar(value) && value === filter.value;
          }
          if (filter.type === 'lte') {
            if (Array.isArray(filter.value)) return false;
            if (!isComparable(value) || !isComparable(filter.value)) return false;
            return value <= filter.value;
          }
          if (filter.type === 'gte') {
            if (Array.isArray(filter.value)) return false;
            if (!isComparable(value) || !isComparable(filter.value)) return false;
            return value >= filter.value;
          }
          if (filter.type === 'in') {
            return Array.isArray(filter.value) && isScalar(value) && filter.value.includes(value);
          }
          return true;
        }),
      );

      if (!this.orderBy) return filtered;

      const { column, ascending } = this.orderBy;
      return filtered.sort((a, b) => {
        const aVal = getValue(a, column) as any;
        const bVal = getValue(b, column) as any;
        if (aVal === bVal) return 0;
        return aVal > bVal ? (ascending ? 1 : -1) : ascending ? -1 : 1;
      });
    }

    then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>) | undefined | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
    ): Promise<TResult1 | TResult2> {
      const result = { data: this.applyFilters(), error: null };
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }
  }

  const supabaseAdmin = {
    from: (table: keyof EscrowTableData | string) => new QueryBuilder(table),
  } as unknown as TypedSupabaseClient;

  const __setTableData = (tables: EscrowTableData) => {
    tableData.gl_accounts = tables.gl_accounts;
    tableData.transactions = tables.transactions;
    tableData.transaction_lines = tables.transaction_lines;
  };

  const __getTableData = () => tableData;

  const mockModule: Partial<typeof import('@/lib/db')> & {
    __setTableData: typeof __setTableData;
    __getTableData: typeof __getTableData;
  } = { supabaseAdmin, __setTableData, __getTableData };

  return mockModule;
});

let setTableData: ((tables: EscrowTableData) => void) | undefined;
let getTableData: (() => EscrowTableData) | undefined;
type MockedDbModule = {
  __setTableData: (tables: EscrowTableData) => void;
  __getTableData: () => EscrowTableData;
};

beforeAll(async () => {
  const db = (await import('@/lib/db')) as unknown as MockedDbModule;
  setTableData = db.__setTableData;
  getTableData = db.__getTableData;
});

const buildTables = (): EscrowTableData => ({
  gl_accounts: [
    { id: 'acc-escrow', gl_account_category: { category: 'deposit' } },
    { id: 'acc-income', gl_account_category: { category: 'income' } },
    { id: 'acc-bank', gl_account_category: { category: 'asset' }, is_bank_account: true },
  ],
  transactions: [],
  transaction_lines: [
    {
      id: 'tl-deposit',
      unit_id: 'unit-1',
      gl_account_id: 'acc-escrow',
      date: '2025-01-05',
      memo: 'Initial deposit',
      amount: 1200,
      posting_type: 'Credit',
    },
    {
      id: 'tl-withdrawal',
      unit_id: 'unit-1',
      gl_account_id: 'acc-escrow',
      date: '2025-01-12',
      memo: 'Repair deduction',
      amount: 150,
      posting_type: 'Debit',
    },
    {
      id: 'tl-negative',
      unit_id: 'unit-1',
      gl_account_id: 'acc-escrow',
      date: '2025-01-01',
      memo: null,
      amount: -50,
      posting_type: 'Debit',
    },
    {
      id: 'tl-other-unit',
      unit_id: 'unit-2',
      gl_account_id: 'acc-escrow',
      date: '2025-01-10',
      memo: 'Other unit deposit',
      amount: 300,
      posting_type: 'Credit',
    },
    {
      id: 'tl-future',
      unit_id: 'unit-1',
      gl_account_id: 'acc-escrow',
      date: '2025-02-01',
      memo: 'After cutoff',
      amount: 250,
      posting_type: 'Credit',
    },
    {
      id: 'tl-income',
      unit_id: 'unit-1',
      gl_account_id: 'acc-income',
      date: '2025-01-15',
      memo: 'Income account',
      amount: 100,
      posting_type: 'Credit',
    },
  ],
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  setTableData?.(buildTables());
});

describe('getEscrowBalance', () => {
  it('calculates deposits and withdrawals per unit up to the cutoff date', async () => {
    const result = await getEscrowBalance('unit-1', '2025-01-31');

    expect(result.hasValidGLAccounts).toBe(true);
    expect(result.deposits).toBe(1200);
    expect(result.withdrawals).toBe(200);
    expect(result.balance).toBe(1000);
  });

  it('flags missing escrow configuration when no deposit accounts exist', async () => {
    setTableData?.({ gl_accounts: [], transaction_lines: [], transactions: [] });

    const result = await getEscrowBalance('unit-1', '2025-01-31');

    expect(result.hasValidGLAccounts).toBe(false);
    expect(result.deposits).toBe(0);
    expect(result.withdrawals).toBe(0);
    expect(result.balance).toBe(0);
  });
});

describe('getEscrowMovements', () => {
  it('returns chronological, sanitized escrow movements for the unit and range', async () => {
    const movements = await getEscrowMovements('unit-1', '2025-01-01', '2025-01-31');

    expect(movements).toHaveLength(3);
    expect(movements.map((m) => m.id)).toEqual(['tl-negative', 'tl-deposit', 'tl-withdrawal']);
    expect(movements[0]).toMatchObject({ amount: 50, type: 'withdrawal', memo: 'Escrow transaction' });
    expect(movements[1]).toMatchObject({ amount: 1200, type: 'deposit' });
    expect(movements[2]).toMatchObject({ amount: 150, type: 'withdrawal' });
  });
});

describe('createEscrowTransaction', () => {
  it('creates balanced deposit entry (debit bank, credit escrow)', async () => {
    const transactionId = await createEscrowTransaction({
      monthlyLogId: 'log-1',
      orgId: 'org-1',
      propertyId: 'prop-1',
      unitId: 'unit-1',
      bankGlAccountId: 'acc-bank',
      escrowGlAccountId: 'acc-escrow',
      date: '2025-01-10',
      memo: 'Security deposit',
      amount: 1200,
      type: 'deposit',
    });

    expect(typeof transactionId).toBe('string');
    const tables = getTableData?.();
    expect(tables?.transactions).toHaveLength(1);
    expect(tables?.transaction_lines).toHaveLength(8); // 6 seeded + 2 new

    const txRow = (tables?.transactions ?? []).find((tx) => tx.id === transactionId);
    expect(txRow?.bank_gl_account_id).toBe('acc-bank');

    const newLines = (tables?.transaction_lines ?? []).filter((l) => l.transaction_id === transactionId);
    expect(newLines).toHaveLength(2);
    const escrowLine = newLines.find((l) => l.gl_account_id === 'acc-escrow');
    const bankLine = newLines.find((l) => l.gl_account_id === 'acc-bank');
    expect(escrowLine?.posting_type).toBe('Credit');
    expect(bankLine?.posting_type).toBe('Debit');
  });

  it('creates balanced withdrawal entry (credit bank, debit escrow)', async () => {
    const transactionId = await createEscrowTransaction({
      monthlyLogId: 'log-1',
      orgId: 'org-1',
      propertyId: 'prop-1',
      unitId: 'unit-1',
      bankGlAccountId: 'acc-bank',
      escrowGlAccountId: 'acc-escrow',
      date: '2025-01-20',
      memo: 'Deposit return',
      amount: 300,
      type: 'withdrawal',
    });

    const tables = getTableData?.();
    const newLines = (tables?.transaction_lines ?? []).filter((l) => l.transaction_id === transactionId);
    const escrowLine = newLines.find((l) => l.gl_account_id === 'acc-escrow');
    const bankLine = newLines.find((l) => l.gl_account_id === 'acc-bank');
    expect(escrowLine?.posting_type).toBe('Debit');
    expect(bankLine?.posting_type).toBe('Credit');
  });
});
