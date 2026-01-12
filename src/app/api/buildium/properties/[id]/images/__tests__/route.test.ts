import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tableData: Record<string, any[]> = {
  properties: [],
  property_images: [],
};

class QueryBuilder implements PromiseLike<{ data: any[]; error: null }> {
  private filters: Array<{ column: string; value: any }> = [];
  private op: 'select' | 'insert' = 'select';
  private insertPayload: any | null = null;
  private limitCount: number | null = null;

  constructor(private table: keyof typeof tableData) {}

  select() {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  order() {
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  insert(payload: any) {
    this.op = 'insert';
    this.insertPayload = payload;
    return this;
  }

  async maybeSingle() {
    const rows = this.applyOperation();
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    const rows = this.applyOperation();
    return { data: rows[0] ?? null, error: null };
  }

  private applyOperation(): any[] {
    if (this.op === 'insert') {
      const rows = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload];
      const normalized = rows.map((row, index) => ({
        id: row?.id ?? `img-${tableData[this.table].length + index + 1}`,
        ...row,
      }));
      tableData[this.table].push(...normalized);
      this.op = 'select';
      this.insertPayload = null;
      return normalized;
    }

    const rows = tableData[this.table] ?? [];
    let filtered = rows.filter((row) => this.filters.every((f) => row[f.column] === f.value));
    if (typeof this.limitCount === 'number') {
      filtered = filtered.slice(0, this.limitCount);
    }
    return filtered;
  }

  then<TResult1 = { data: any[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: any[]; error: null }) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | undefined | null,
  ): Promise<TResult1 | TResult2> {
    const rows = this.applyOperation();
    const payload = { data: rows, error: null as null };
    return Promise.resolve(payload).then(onfulfilled, onrejected);
  }
}

const supabaseStub = {
  from: (table: keyof typeof tableData) => new QueryBuilder(table),
};

const requireAuthMock = vi.fn().mockResolvedValue({
  supabase: supabaseStub,
  supabaseAdmin: supabaseStub,
  user: { id: '00000000-0000-0000-0000-000000000001' },
  roles: ['org_admin'],
  orgRoles: {},
});

const requireRoleMock = vi.fn().mockResolvedValue(undefined);

const checkRateLimitMock = vi.fn().mockResolvedValue({ success: true });

const uploadPropertyImageMock = vi.fn().mockResolvedValue({
  data: {
    Id: 777,
    Name: 'Remote image',
    Description: 'From Buildium',
    IsPrivate: false,
    SortOrder: 5,
    Href: 'https://example.com/image.jpg',
  },
});

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: requireAuthMock,
  requireRole: requireRoleMock,
}));

vi.mock('@/lib/auth/org-guards', () => ({
  requireOrgMember: vi.fn().mockResolvedValue({ orgId: 'org-1' }),
}));

vi.mock('@/lib/org/resolve-org-id', () => ({
  resolveOrgIdFromRequest: vi.fn().mockResolvedValue('org-1'),
}));

vi.mock('@/lib/db', () => ({
  supabase,
  supabaseAdmin,
}) as unknown as Record<string, unknown>);

const supabase = supabaseStub;
const supabaseAdmin = supabaseStub;

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: checkRateLimitMock,
}));

vi.mock('@/lib/buildium-edge-client', () => ({
  getOrgScopedBuildiumEdgeClient: vi.fn().mockResolvedValue({
    uploadPropertyImage: uploadPropertyImageMock,
  }),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeAndValidate: (_body: unknown, _schema: unknown) => _body,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const { GET, POST } = await import('../route');

const makeGetRequest = () =>
  new NextRequest('http://localhost/api/buildium/properties/prop-1/images', {
    method: 'GET',
  });

const makePostRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/buildium/properties/prop-1/images', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('Buildium property images API', () => {
  beforeEach(() => {
    tableData.properties = [];
    tableData.property_images = [];
    requireAuthMock.mockClear();
    requireRoleMock.mockClear();
    checkRateLimitMock.mockClear();
    uploadPropertyImageMock.mockClear();
  });

  it('GET returns images for a property', async () => {
    tableData.properties.push({ id: 'prop-1', org_id: 'org-1' });
    tableData.property_images.push(
      { id: 'img-1', property_id: 'prop-1', sort_index: 1 },
      { id: 'img-2', property_id: 'prop-1', sort_index: 2 },
    );

    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: 'prop-1' }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: Array<{ id: string }> };

    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe('img-1');
  });

  it('POST stores a local image when property is not linked to Buildium', async () => {
    tableData.properties.push({
      id: 'prop-1',
      buildium_property_id: null,
      org_id: 'org-1',
    });

    const res = await POST(
      makePostRequest({
        FileName: 'photo.jpg',
        FileData: 'data:image/jpeg;base64,AAAA',
        Description: 'Front photo',
      }),
      { params: Promise.resolve({ id: 'prop-1' }) },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { id: string; property_id: string; name: string };
    };

    expect(body.success).toBe(true);
    expect(body.data.property_id).toBe('prop-1');
    expect(body.data.name).toBe('photo.jpg');
    expect(tableData.property_images).toHaveLength(1);
  });

  it('POST uploads to Buildium when buildium_property_id is present', async () => {
    tableData.properties.push({
      id: 'prop-1',
      buildium_property_id: 1234,
      org_id: 'org-1',
    });

    const res = await POST(
      makePostRequest({
        FileName: 'remote.jpg',
        FileData: 'data:image/jpeg;base64,BBBB',
        Description: 'Remote photo',
      }),
      { params: Promise.resolve({ id: 'prop-1' }) },
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { buildium_image_id?: number | null };
    };

    expect(body.success).toBe(true);
    expect(uploadPropertyImageMock).toHaveBeenCalled();
    expect(body.data.buildium_image_id).toBe(777);
    expect(tableData.property_images[0].buildium_image_id).toBe(777);
  });
});
