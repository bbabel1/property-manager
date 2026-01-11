import { NextRequest } from 'next/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-1' }),
}));

vi.mock('@/lib/csrf', () => ({
  validateCSRFToken: vi.fn().mockResolvedValue(true),
}));

const tableData: Record<string, any[]> = {
  properties: [],
  membership_roles: [
    { org_id: 'org-1', user_id: 'user-1', role_id: 'org_admin', roles: { name: 'org_admin' } },
  ],
};

class QueryBuilder {
  private filters: Array<{ column: string; value: any }> = [];
  private patch: Record<string, any> | null = null;

  constructor(private table: string) {}

  select() {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  maybeSingle() {
    const rows = this.applyFilters();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  single() {
    const rows = this.applyFilters();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  update(patch: Record<string, any>) {
    this.patch = patch;
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: any[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ) {
    return Promise.resolve({ data: this.applyFilters(), error: null }).then(onfulfilled, onrejected);
  }

  private applyFilters() {
    const rows = tableData[this.table] ?? [];
    const filtered = rows.filter((row) =>
      this.filters.every((f) => row[f.column] === f.value),
    );
    if (this.patch && filtered[0]) {
      Object.assign(filtered[0], this.patch);
    }
    return filtered;
  }
}

const supabaseAdmin = {
  from: (table: string) => new QueryBuilder(table),
};

vi.mock('@/lib/db', () => ({
  supabaseAdmin,
  supabase: supabaseAdmin,
}));

const { PUT } = await import('../[id]/route');

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/properties/prop-1', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': 'token',
      'x-auth-user': encodeURIComponent(JSON.stringify({ id: 'user-1' })),
    },
    body: JSON.stringify(body),
  });

describe('PUT /api/properties/[id]', () => {
  beforeEach(() => {
    tableData.properties = [{ id: 'prop-1', org_id: 'org-1' }];
    tableData.membership_roles = [
      { org_id: 'org-1', user_id: 'user-1', role_id: 'org_admin', roles: { name: 'org_admin' } },
    ];
  });

  it('returns 404 when property is not found', async () => {
    tableData.properties = [];
    const req = makeRequest({
      name: 'Example',
      address_line1: '123 Main',
      city: 'City',
      state: 'ST',
      postal_code: '12345',
      country: 'United States',
      status: 'Active',
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'missing' }) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Property not found' });
  });

  it('updates property fields when authorized and valid', async () => {
    const req = makeRequest({
      name: 'Example',
      address_line1: '123 Main',
      city: 'City',
      state: 'ST',
      postal_code: '12345',
      country: 'United States',
      status: 'Active',
      reserve: 1000,
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body?.property?.name).toBe('Example');
    expect(body?.property?.reserve).toBe(1000);
    expect(tableData.properties[0].reserve).toBe(1000);
  });
});
