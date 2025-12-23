import { describe, expect, test, vi, beforeEach } from 'vitest';

import { createBankGlAccountWithBuildium } from '@/lib/bank-account-create';

type Row = Record<string, any>;

class MockTable {
  rows: Row[] = [];

  insert(payload: Row) {
    const next = Array.isArray(payload) ? payload[0] : payload;
    const existing = this.rows.find((r) => r.buildium_gl_account_id === next.buildium_gl_account_id);
    const error = existing ? { message: 'duplicate key value violates unique constraint' } : null;
    const data = existing
      ? null
      : (() => {
          const id = next.id ?? `gl-${this.rows.length + 1}`;
          const row = { ...next, id };
          this.rows.push(row);
          return row;
        })();

    return {
      select: () => ({
        single: async () => ({ data, error }),
      }),
    };
  }

  update(payload: Row) {
    const filters: Array<{ col: string; val: any }> = [];
    const selectFn = () => ({
      single: async () => {
        const idx = this.rows.findIndex((r) => filters.every((f) => r[f.col] === f.val));
        if (idx === -1) return { data: null, error: { message: 'not found' } };
        this.rows[idx] = { ...this.rows[idx], ...payload };
        return { data: this.rows[idx], error: null };
      },
      maybeSingle: async () => {
        const idx = this.rows.findIndex((r) => filters.every((f) => r[f.col] === f.val));
        if (idx === -1) return { data: null, error: null };
        this.rows[idx] = { ...this.rows[idx], ...payload };
        return { data: this.rows[idx], error: null };
      },
    });
    const builder: any = {
      eq: (col: string, val: any) => {
        filters.push({ col, val });
        return builder;
      },
      select: selectFn,
    };
    return builder;
  }

  select(_cols: string) {
    const filters: Array<{ col: string; val: any }> = [];
    const rows = this.rows;
    return {
      eq(col: string, val: any) {
        filters.push({ col, val });
        return this;
      },
      limit() {
        return this;
      },
      maybeSingle: async () => {
        const match = rows.find((r) => filters.every((f) => r[f.col] === f.val));
        return { data: match ?? null, error: null };
      },
    };
  }

  delete() {
    const filters: Array<{ col: string; val: any }> = [];
    const runDelete = async () => {
      const keep: Row[] = [];
      let deleted = 0;
      this.rows.forEach((r) => {
        if (filters.every((f) => r[f.col] === f.val)) {
          deleted += 1;
        } else {
          keep.push(r);
        }
      });
      this.rows = keep;
      return { data: deleted, error: null };
    };
    return {
      eq: (col: string, val: any) => {
        filters.push({ col, val });
        return {
          then: (resolve: any) => runDelete().then(resolve),
          catch: (reject: any) => runDelete().catch(reject),
          finally: (onFinally: any) => runDelete().finally(onFinally),
        };
      },
    };
  }
}

class MockSupabase {
  tables: Record<string, MockTable> = {
    gl_accounts: new MockTable(),
  };

  from(table: string) {
    return this.tables[table];
  }
}

vi.mock('@/lib/buildium-http', () => {
  return {
    buildiumFetch: vi.fn(async () => ({
      ok: true,
      status: 201,
      json: {
        Id: 9999,
        Name: 'Mock Bank',
        BankAccountType: 'Checking',
        AccountNumber: '1111222233334444',
        RoutingNumber: '021000021',
        Country: 'UnitedStates',
        GLAccount: { Type: 'Asset' },
      },
    })),
  };
});

describe('createBankGlAccountWithBuildium (mocked)', () => {
  let supabase: MockSupabase;

  beforeEach(() => {
    supabase = new MockSupabase();
  });

  test('creates and persists bank account locally', async () => {
    const result = await createBankGlAccountWithBuildium({
      supabase: supabase as any,
      orgId: 'org-1',
      payload: {
        name: 'Test Bank',
        description: 'desc',
        bank_account_type: 'checking',
        account_number: '1234567890',
        routing_number: '021000021',
        country: 'United States',
        bank_information_lines: ['Line A'],
        company_information_lines: ['Line B'],
      },
    });

    expect(result.success).toBe(true);
    expect(result.record.buildium_gl_account_id).toBe(9999);
    expect(result.record.bank_account_number).toBe('1111222233334444');
    expect(result.record.bank_routing_number).toBe('021000021');
    expect(result.record.bank_country).toBe('United States');
  });

  test('handles duplicate insert by updating existing row', async () => {
    // First create
    await createBankGlAccountWithBuildium({
      supabase: supabase as any,
      orgId: 'org-1',
      payload: {
        name: 'First',
        bank_account_type: 'checking',
        account_number: '1234567890',
        routing_number: '021000021',
        country: 'United States',
      },
    });

    // Second attempt with same buildium id (mock returns same Id=9999)
    const result = await createBankGlAccountWithBuildium({
      supabase: supabase as any,
      orgId: 'org-1',
      payload: {
        name: 'Updated Name',
        bank_account_type: 'checking',
        account_number: '0000',
        routing_number: '021000021',
        country: 'United States',
      },
    });

    expect(result.success).toBe(true);
    expect(result.record.name).toBe('Mock Bank'); // Buildium response wins
  });
});
