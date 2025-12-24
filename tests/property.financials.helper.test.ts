import { describe, it, expect, beforeAll } from 'vitest';

let fetchPropertyFinancials!: typeof import('@/server/financials/property-finance').fetchPropertyFinancials;

type Row = Record<string, unknown>;
type DataResponse<T> = { data: T; error: null };

class MockQuery {
  private rows: Row[];
  private filterField?: string;
  private filterValue?: unknown;
  private inField?: string;
  private inValues?: unknown[];
  private lteField?: string;
  private lteValue?: unknown;

  constructor(rows: Row[]) {
    this.rows = rows;
  }
  select() {
    return this;
  }
  eq(field: string, value: unknown) {
    this.filterField = field;
    this.filterValue = value;
    return this;
  }
  in(field: string, values: unknown[]) {
    this.inField = field;
    this.inValues = values;
    return this;
  }
  lte(field: string, value: unknown) {
    this.lteField = field;
    this.lteValue = value;
    return this;
  }
  async single(): Promise<DataResponse<Row | null>> {
    const filtered = await this.getData();
    return { data: filtered[0] ?? null, error: null };
  }
  async maybeSingle(): Promise<DataResponse<Row | null>> {
    return this.single();
  }
  async thenResolve(): Promise<Row[]> {
    return this.getData();
  }
  async getData(): Promise<Row[]> {
    return this.applyFilters(this.rows);
  }
  async returns(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async returnsObject(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async returnsArray(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async returnsUndefined(): Promise<{ data: undefined; error: null }> {
    return { data: undefined, error: null };
  }
  async returnsNull(): Promise<DataResponse<null>> {
    return { data: null, error: null };
  }
  async returnsAny(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async get(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async returnsList(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async returnsMaybeSingle(): Promise<DataResponse<Row | null>> {
    const data = await this.getData();
    return { data: data[0] ?? null, error: null };
  }
  async returnsWithError(error: unknown): Promise<{ data: null; error: unknown }> {
    return { data: null, error };
  }
  async returnsData(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async run(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async returnsSelect(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async returnsInfo(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async returnsMaybe(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async returnsDefault(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async returnsFull(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  async returnsAnyArray(): Promise<DataResponse<Row[]>> {
    return { data: await this.getData(), error: null };
  }
  then(resolve: (value: DataResponse<Row[]>) => unknown, reject?: (reason: unknown) => unknown) {
    return (async () => ({ data: await this.getData(), error: null as null }))().then(resolve, reject);
  }
  private applyFilters(rows: Row[]): Row[] {
    return rows.filter((r) => {
      if (this.filterField && this.filterValue !== undefined) {
        if ((r as Record<string, unknown>)[this.filterField] != this.filterValue) return false;
      }
      if (this.inField && Array.isArray(this.inValues)) {
        const value = (r as Record<string, unknown>)[this.inField];
        if (!this.inValues.map(String).includes(String(value))) return false;
      }
      if (this.lteField && this.lteValue !== undefined && (r as Record<string, unknown>)[this.lteField] !== undefined) {
        if (new Date((r as Record<string, string>)[this.lteField]) > new Date(this.lteValue as string)) return false;
      }
      return true;
    });
  }
}

class MockClient {
  private tables: Record<string, Row[]>;
  private rpcData: unknown = null;
  constructor(tables: Record<string, Row[]>, rpcData: unknown = null) {
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

  const linesOnlyTransactions: Row[] = []; // simulate missing transactions table

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
    ) as unknown as Parameters<typeof fetchPropertyFinancials>[2];

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
    ) as unknown as Parameters<typeof fetchPropertyFinancials>[2];

    const { fin } = await fetchPropertyFinancials(propertyId, '2025-12-19', mock);
    expect(fin.cash_balance).toBe(10050);
    expect(fin.security_deposits).toBe(-5000);
    expect(fin.available_balance).toBe(5050);
  });
});
