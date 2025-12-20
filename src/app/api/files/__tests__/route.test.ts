import { NextRequest } from 'next/server';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { FILE_ENTITY_TYPES } from '@/lib/files';

const getFilesByEntity = vi.hoisted(() => vi.fn().mockResolvedValue([{ id: 'f1' }]));
const supabase = vi.hoisted(() => ({ stub: true }));

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn().mockResolvedValue({ id: 'user-1', app_metadata: { org_id: 'org-ctx' } }),
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue(supabase),
}));

vi.mock('@/lib/files', async () => {
  const actual = await vi.importActual<any>('@/lib/files');
  return { ...actual, getFilesByEntity };
});

const { GET } = await import('../route');

const makeRequest = (qs: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/api/files?${qs}`, { headers });

describe('GET /api/files', () => {
  beforeEach(() => {
    getFilesByEntity.mockClear();
  });

  it('returns 400 for missing params', async () => {
    const res = await GET(makeRequest('entityType=Properties'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid entityType', async () => {
    const res = await GET(makeRequest('entityType=Bad&type=1&entityId=1'));
    expect(res.status).toBe(400);
  });

  it('prefers orgId from header or user metadata', async () => {
    const res = await GET(
      makeRequest(`entityType=${FILE_ENTITY_TYPES.PROPERTIES}&entityId=10`, { 'x-org-id': 'org-hdr' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: [{ id: 'f1' }], count: 1 });
    expect(getFilesByEntity).toHaveBeenCalledWith(supabase, 'org-hdr', FILE_ENTITY_TYPES.PROPERTIES, 10);
  });

  it('falls back to user org when header/query missing', async () => {
    const { requireUser } = await import('@/lib/auth');
    (requireUser as any).mockResolvedValueOnce({ id: 'user-1', app_metadata: { org_id: 'org-ctx' } });

    const res = await GET(makeRequest(`entityType=${FILE_ENTITY_TYPES.PROPERTIES}&entityId=5`));
    expect(res.status).toBe(200);
    expect(getFilesByEntity).toHaveBeenCalledWith(supabase, 'org-ctx', FILE_ENTITY_TYPES.PROPERTIES, 5);
  });
});
