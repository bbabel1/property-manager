import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: vi.fn().mockResolvedValue({ roles: ['platform_admin'] }),
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: () => true,
}));

vi.mock('@/lib/monthly-log-calculations', () => ({
  calculateFinancialSummary: vi.fn().mockResolvedValue({
    ownerDraw: 1250,
    ownerDrawTransactions: [{ id: 'tx1', amount: 1250 }],
    previousBalance: 100,
    totalPayments: 2000,
    totalBills: 500,
    escrowAmount: 0,
    managementFees: 250,
    netToOwner: 0,
  }),
  refreshMonthlyLogTotals: vi.fn(),
}));

vi.mock('@/lib/lease-transaction-helpers', () => ({
  assignTransactionToMonthlyLog: vi.fn(),
  fetchTransactionWithLines: vi.fn(),
}));

type TableName =
  | 'monthly_logs'
  | 'properties'
  | 'gl_accounts'
  | 'ownerships'
  | 'transactions'
  | 'transaction_lines';

type MonthlyLogRow = {
  id: string;
  org_id: string;
  property_id: string;
  unit_id: string;
  properties: {
    id: string;
    org_id: string;
    buildium_property_id: number;
    operating_bank_gl_account_id: string;
  }[];
  units: { id: string; property_id: string; buildium_property_id: number; buildium_unit_id: number }[];
};
type PropertyRow = {
  id: string;
  org_id: string;
  buildium_property_id: number;
  operating_bank_gl_account_id: string;
};
type GlAccountRow = {
  id: string;
  name: string;
  org_id: string;
  buildium_gl_account_id: number;
  is_bank_account?: boolean | null;
};
type OwnershipRow = {
  property_id: string;
  owner_id: string;
  owners: { id: string; buildium_owner_id: number } | null;
};
type TransactionRow = Record<string, unknown>;
type TransactionLineRow = Record<string, unknown>;

type RowByTable = {
  monthly_logs: MonthlyLogRow;
  properties: PropertyRow;
  gl_accounts: GlAccountRow;
  ownerships: OwnershipRow;
  transactions: TransactionRow;
  transaction_lines: TransactionLineRow;
};

const supabaseData: { [K in TableName]: RowByTable[K][] } = {
  monthly_logs: [
      {
        id: 'log-1',
        org_id: 'org-1',
        property_id: 'prop-1',
        unit_id: 'unit-1',
      properties: [
        {
          id: 'prop-1',
          org_id: 'org-1',
          buildium_property_id: 11,
          operating_bank_gl_account_id: 'gl-bank-1',
        },
      ],
      units: [{ id: 'unit-1', property_id: 'prop-1', buildium_property_id: 11, buildium_unit_id: 22 }],
    },
  ],
  properties: [
    {
          id: 'prop-1',
          org_id: 'org-1',
          buildium_property_id: 11,
          operating_bank_gl_account_id: 'gl-bank-1',
        },
      ],
  gl_accounts: [
    {
      id: 'gl-bank-1',
      name: 'Operating Bank GL',
      org_id: 'org-1',
      buildium_gl_account_id: 4321,
      is_bank_account: true,
    },
    {
      id: 'gl-owner-draw',
      name: 'Owner Draw',
      org_id: 'org-1',
      buildium_gl_account_id: 999,
    },
  ],
  ownerships: [
    {
      property_id: 'prop-1',
      owner_id: 'owner-1',
      owners: { id: 'owner-1', buildium_owner_id: 555 },
    },
  ],
  transactions: [],
  transaction_lines: [],
};

class QueryBuilder<Table extends TableName>
  implements PromiseLike<{ data: RowByTable[Table][]; error: null }>
{
  private filters: Array<{ column: keyof RowByTable[Table]; value: unknown; op: 'eq' | 'ilike' }> = [];
  private inFilters: Array<{ column: keyof RowByTable[Table]; values: unknown[] }> = [];
  private sort: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private op: 'select' | 'insert' = 'select';
  private pendingInsert: RowByTable[Table][] | null = null;

  constructor(private table: Table) {}

  select() {
    return this;
  }

  eq(column: keyof RowByTable[Table], value: unknown) {
    this.filters.push({ column, value, op: 'eq' });
    return this;
  }

  ilike(column: keyof RowByTable[Table], value: unknown) {
    this.filters.push({ column, value, op: 'ilike' });
    return this;
  }

  in(column: keyof RowByTable[Table], values: unknown[]) {
    this.inFilters.push({ column, values });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.sort = { column, ascending: options.ascending ?? true };
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  insert(payload: RowByTable[Table] | RowByTable[Table][]) {
    this.op = 'insert';
    this.pendingInsert = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  maybeSingle() {
    const rows = this.applyOperation();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  single() {
    const rows = this.applyOperation();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  private applyOperation(): RowByTable[Table][] {
    if (this.op === 'insert') {
      const rows = this.pendingInsert ?? [];
      const normalized = rows.map((row) => ({
        id:
          typeof row?.id === 'string'
            ? row.id
            : this.table === 'transactions'
              ? 'tx-new'
              : this.table === 'transaction_lines'
                ? `tl-${supabaseData.transaction_lines.length + 1}`
                : `row-${Math.random().toString(16).slice(2)}`,
        ...row,
      }));
      supabaseData[this.table].push(...normalized);
      this.pendingInsert = null;
      return normalized;
    }

    const rows = [...(supabaseData[this.table] ?? [])];
    const filtered = rows.filter((row) =>
      this.filters.every((filter) => {
        if (filter.op === 'eq') return row[filter.column] === filter.value;
        if (filter.op === 'ilike') {
          const needle = String(filter.value ?? '').toLowerCase().replace(/%/g, '');
          return String(row[filter.column] ?? '').toLowerCase().includes(needle);
        }
        return true;
      }) &&
        this.inFilters.every(
          (filter) => Array.isArray(filter.values) && filter.values.includes(row[filter.column]),
        ),
    );

    if (this.sort) {
      const { column, ascending } = this.sort;
      filtered.sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (av === bv) return 0;
        return av > bv ? (ascending ? 1 : -1) : ascending ? -1 : 1;
      });
    }

    if (typeof this.limitCount === 'number') {
      return filtered.slice(0, this.limitCount);
    }

    return filtered;
  }

  then<TResult1 = { data: RowByTable[Table][]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: RowByTable[Table][]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    const rows = this.applyOperation();
    const payload = { data: rows, error: null };
    return Promise.resolve(payload).then(onfulfilled, onrejected);
  }
}

vi.mock('@/lib/db', () => ({
  supabaseAdmin: {
    from: (table: TableName) => new QueryBuilder(table),
  },
}));

const { GET, POST } = await import('../route');

const makeRequest = (method: 'GET' | 'POST', body?: unknown) =>
  new NextRequest(`http://localhost/api/monthly-logs/log-1/owner-draw`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

describe('/api/monthly-logs/[logId]/owner-draw', () => {
  it('returns owner draw summary on GET', async () => {
    const res = await GET(makeRequest('GET'), { params: Promise.resolve({ logId: 'log-1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ownerDraw).toBe(1250);
    expect(json.netToOwner).toBe(0);
    expect(json.transactions).toHaveLength(1);
  });

  it('validates payload on POST', async () => {
    const res = await POST(makeRequest('POST', {}), { params: Promise.resolve({ logId: 'log-1' }) });
    expect(res.status).toBe(400);
  });

  it('writes balanced owner draw journal lines on POST', async () => {
    process.env.BUILDIUM_BASE_URL = 'https://example.buildium.test';
    process.env.BUILDIUM_CLIENT_ID = 'client';
    process.env.BUILDIUM_CLIENT_SECRET = 'secret';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ Id: 1000, CheckNumber: '123' }),
    });
    global.fetch = fetchMock;

    const payload = {
      payeeId: 'owner-1',
      date: '2025-11-15',
      amount: 1250,
      memo: 'Owner draw',
      checkNumber: '123',
      referenceNumber: 'ref-1',
    };

    const res = await POST(makeRequest('POST', payload), {
      params: Promise.resolve({ logId: 'log-1' }),
    });
    expect(res.status).toBe(201);

    expect(supabaseData.transaction_lines).toHaveLength(2);
    const [line1, line2] = supabaseData.transaction_lines;

    const ownerDrawLine =
      line1.gl_account_id === 'gl-owner-draw' ? line1 : line2.gl_account_id === 'gl-owner-draw' ? line2 : null;
    const bankLine =
      line1.gl_account_id === 'gl-bank-1' ? line1 : line2.gl_account_id === 'gl-bank-1' ? line2 : null;

    expect(ownerDrawLine).not.toBeNull();
    expect(bankLine).not.toBeNull();
    expect(ownerDrawLine?.posting_type).toBe('Debit');
    expect(bankLine?.posting_type).toBe('Credit');
    expect(ownerDrawLine?.amount).toBe(1250);
    expect(bankLine?.amount).toBe(1250);
  });
});
