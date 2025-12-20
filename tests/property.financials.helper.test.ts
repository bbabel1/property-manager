import { describe, it, expect, beforeAll } from 'vitest';
let fetchPropertyFinancials!: typeof import('@/server/financials/property-finance').fetchPropertyFinancials;

type Row = Record<string, any>;

class MockQuery {
  private rows: Row[];
  private filterField?: string;
  private filterValue: any;
  private inField?: string;
  private inValues?: any[];
  private lteField?: string;
  private lteValue?: any;

  constructor(rows: Row[]) {
    this.rows = rows;
  }
  select() {
    return this;
  }
  eq(field: string, value: any) {
    this.filterField = field;
    this.filterValue = value;
    return this;
  }
  in(field: string, values: any[]) {
    this.inField = field;
    this.inValues = values;
    return this;
  }
  lte(field: string, value: any) {
    this.lteField = field;
    this.lteValue = value;
    return this;
  }
  async single() {
    const filtered = await this.getData();
    return { data: filtered[0] ?? null, error: null };
  }
  async maybeSingle() {
    return this.single();
  }
  async thenResolve() {
    return this.getData();
  }
  async getData() {
    return this.applyFilters(this.rows);
  }
  async returns() {
    return { data: await this.getData(), error: null };
  }
  async returnsObject() {
    return { data: await this.getData(), error: null };
  }
  async returnsArray() {
    return { data: await this.getData(), error: null };
  }
  async returnsUndefined() {
    return { data: undefined, error: null };
  }
  async returnsNull() {
    return { data: null, error: null };
  }
  async returnsAny() {
    return { data: await this.getData(), error: null };
  }
  async get() {
    return { data: await this.getData(), error: null };
  }
  async returnsList() {
    return { data: await this.getData(), error: null };
  }
  async returnsMaybeSingle() {
    const data = await this.getData();
    return { data: data[0] ?? null, error: null };
  }
  async returnsWithError(error: any) {
    return { data: null, error };
  }
  async returnsData() {
    return { data: await this.getData(), error: null };
  }
  async run() {
    return { data: await this.getData(), error: null };
  }
  async returnsSelect() {
    return { data: await this.getData(), error: null };
  }
  async returnsInfo() {
    return { data: await this.getData(), error: null };
  }
  async returnsMaybe() {
    return { data: await this.getData(), error: null };
  }
  async returnsDefault() {
    return { data: await this.getData(), error: null };
  }
  async returnsFull() {
    return { data: await this.getData(), error: null };
  }
  async returnsAnyArray() {
    return { data: await this.getData(), error: null };
  }
  then(resolve: any, reject?: any) {
    return (async () => ({ data: await this.getData(), error: null }))().then(resolve, reject);
  }
  private applyFilters(rows: Row[]) {
    return rows.filter((r) => {
      if (this.filterField && this.filterValue !== undefined) {
        if (r[this.filterField] != this.filterValue) return false;
      }
      if (this.inField && Array.isArray(this.inValues)) {
        if (!this.inValues.map(String).includes(String(r[this.inField]))) return false;
      }
      if (this.lteField && this.lteValue !== undefined && r[this.lteField] !== undefined) {
        if (new Date(r[this.lteField]) > new Date(this.lteValue)) return false;
      }
      return true;
    });
  }
}

class MockClient {
  private tables: Record<string, Row[]>;
  private rpcData: any = null;
  constructor(tables: Record<string, Row[]>, rpcData: any = null) {
    this.tables = tables;
    this.rpcData = rpcData;
  }
  rpc() {
    return Promise.resolve({ data: this.rpcData, error: null });
  }
  from(table: string) {
    return new MockQuery(this.tables[table] || []);
  }
}

describe('fetchPropertyFinancials helper', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon-key';
    fetchPropertyFinancials = (await import('@/server/financials/property-finance')).fetchPropertyFinancials;
  });
  const propertyId = 'prop-1';
  const unitId = 'unit-1';
  const leaseId = 101;
  const buildiumLeaseId = 202;

  const propertyRows = [
    { id: propertyId, reserve: 0, balance: 0, deposits_held_balance: 0, prepayments_balance: 0 },
  ];
  const unitRows = [{ id: unitId, property_id: propertyId }];
  const leaseRows = [{ id: leaseId, buildium_lease_id: buildiumLeaseId, property_id: propertyId }];
  const transactionLines = [
    // Deposit line
    {
      id: 'tl-1',
      property_id: propertyId,
      unit_id: unitId,
      transaction_id: 'tx-dep',
      amount: 5000,
      posting_type: 'Credit',
      date: '2025-12-18',
      gl_accounts: { type: 'liability', is_security_deposit_liability: true, name: 'Security Deposit' },
    },
    // Rent income (non-bank)
    {
      id: 'tl-2',
      property_id: propertyId,
      unit_id: unitId,
      transaction_id: 'tx-rent',
      amount: 5000,
      posting_type: 'Credit',
      date: '2025-12-18',
      gl_accounts: { type: 'income', name: 'Rent Income' },
    },
    // Utility income
    {
      id: 'tl-3',
      property_id: propertyId,
      unit_id: unitId,
      transaction_id: 'tx-rent',
      amount: 50,
      posting_type: 'Credit',
      date: '2025-12-18',
      gl_accounts: { type: 'income', name: 'Utility Income' },
    },
  ];
  const transactions = [
    { id: 'tx-dep', lease_id: leaseId, total_amount: 5000, transaction_type: 'Payment', date: '2025-12-18' },
    { id: 'tx-rent', lease_id: leaseId, total_amount: 5050, transaction_type: 'Payment', date: '2025-12-18' },
  ];

  const linesOnlyTransactions: any[] = []; // simulate missing transactions table

  it('derives finances when RPC is empty (payment fallback + deposit matching)', async () => {
    const mock = new MockClient(
      {
        properties: propertyRows,
        units: unitRows,
        lease: leaseRows,
        transaction_lines: transactionLines,
        transactions,
      },
      null, // rpc data -> force fallback
    ) as any;

    const { fin } = await fetchPropertyFinancials(propertyId, '2025-12-19', mock);
    expect(fin.cash_balance).toBe(10050);
    expect(fin.security_deposits).toBe(-5000);
    expect(fin.available_balance).toBe(5050);
  });

  it('derives finances from transaction_lines when transactions table is empty', async () => {
    const mock = new MockClient(
      {
        properties: propertyRows,
        units: unitRows,
        lease: leaseRows,
        transaction_lines: transactionLines,
        transactions: linesOnlyTransactions,
      },
      null,
    ) as any;

    const { fin } = await fetchPropertyFinancials(propertyId, '2025-12-19', mock);
    expect(fin.cash_balance).toBe(10050);
    expect(fin.security_deposits).toBe(-5000);
    expect(fin.available_balance).toBe(5050);
  });
});
