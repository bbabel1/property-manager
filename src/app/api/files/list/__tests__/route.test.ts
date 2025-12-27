import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FILE_ENTITY_TYPES } from '@/lib/files';

type TableName =
  | 'org_memberships'
  | 'files'
  | 'file_categories'
  | 'properties'
  | 'units'
  | 'lease'
  | 'tenants'
  | 'owners'
  | 'vendors'
  | 'contacts';

type SupabaseRow = Record<string, unknown>;

const supabaseData: Record<TableName, SupabaseRow[]> = {
  org_memberships: [],
  files: [],
  file_categories: [],
  properties: [],
  units: [],
  lease: [],
  tenants: [],
  owners: [],
  vendors: [],
  contacts: [],
};

class QueryBuilder implements PromiseLike<{ data: SupabaseRow[]; error: null; count?: number }> {
  constructor(private table: TableName) {}

  select() {
    return this;
  }

  eq() {
    return this;
  }

  is() {
    return this;
  }

  in() {
    return this;
  }

  gte() {
    return this;
  }

  lt() {
    return this;
  }

  order() {
    return this;
  }

  range() {
    return this;
  }

  or() {
    return this;
  }

  ilike() {
    return this;
  }

  limit() {
    return this;
  }

  async maybeSingle() {
    const rows = supabaseData[this.table] ?? [];
    return { data: (rows[0] as SupabaseRow | undefined) ?? null, error: null };
  }

  then<TResult1 = { data: SupabaseRow[]; error: null; count?: number }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: SupabaseRow[]; error: null; count?: number }) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    const rows = supabaseData[this.table] ?? [];
    const payload: { data: SupabaseRow[]; error: null; count?: number } = {
      data: rows,
      error: null,
      ...(this.table === 'files' ? { count: rows.length } : {}),
    };
    return Promise.resolve(payload).then(onfulfilled, onrejected);
  }
}

const supabaseStub = {
  from(table: TableName) {
    return new QueryBuilder(table);
  },
};

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'user@example.com',
    user_metadata: {},
    app_metadata: {},
  }),
}));

vi.mock('@/lib/db', () => ({
  supabaseAdminMaybe: supabaseStub,
  supabase: supabaseStub,
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue(supabaseStub),
}));

const { GET } = await import('../route');

const makeRequest = (qs: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/api/files/list?${qs}`, { headers });

describe('GET /api/files/list', () => {
  beforeEach(() => {
    // Reset in-place without changing object identity
    (Object.keys(supabaseData) as TableName[]).forEach((table) => {
      supabaseData[table] = [];
    });

    // Seed membership so org check passes
    supabaseData.org_memberships.push({
      org_id: 'org-1',
      user_id: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('returns enriched files with category and location', async () => {
    supabaseData.files.push({
      id: 'file-1',
      org_id: 'org-1',
      file_name: 'lease.pdf',
      title: 'Lease Doc',
      description: null,
      mime_type: 'application/pdf',
      size_bytes: 1024,
      entity_type: FILE_ENTITY_TYPES.PROPERTIES,
      entity_id: 11,
      buildium_category_id: 101,
      storage_key: 'property/prop-uuid/lease.pdf',
      deleted_at: null,
      created_at: '2025-01-01T00:00:00.000Z',
    });

    supabaseData.file_categories.push({
      id: 'cat-1',
      org_id: 'org-1',
      buildium_category_id: 101,
      category_name: 'Property Docs',
    });

    supabaseData.properties.push({
      id: 'prop-uuid',
      org_id: 'org-1',
      buildium_property_id: 11,
      name: 'Test Property',
      address_line1: '123 Main St',
      address_line2: null,
      city: 'Boston',
      state: 'MA',
      property_type: 'single_family',
    });

    const res = await GET(
      makeRequest('', {
        'x-org-id': 'org-1',
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Array<{
        id: string;
        category_name?: string;
        location?: string;
        entity_types?: string[];
      }>;
      pagination: { total: number; page: number; limit: number };
    };

    expect(body.success).toBe(true);
    expect(body.pagination.total).toBe(1);
    expect(body.data[0].id).toBe('file-1');
    expect(body.data[0].category_name).toBe('Property Docs');
    expect(body.data[0].location).toContain('Test Property');
    expect(body.data[0].entity_types).toEqual(['property']);
  });
});

