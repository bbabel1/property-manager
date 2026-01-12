import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getSupabaseServerClient: vi.fn(),
  requireOrgMember: vi.fn(),
  buildiumFetch: vi.fn(),
  requireBuildiumEnabledOr403: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireUser: mocks.requireUser,
}));

vi.mock('@/lib/supabase/server', () => ({
  getSupabaseServerClient: mocks.getSupabaseServerClient,
}));

vi.mock('@/lib/auth/org-guards', () => ({
  requireOrgMember: mocks.requireOrgMember,
}));

vi.mock('@/lib/buildium-http', () => ({
  buildiumFetch: mocks.buildiumFetch,
}));

vi.mock('@/lib/buildium-route-guard', () => ({
  requireBuildiumEnabledOr403: mocks.requireBuildiumEnabledOr403,
}));

// Import after mocks
import { POST } from '../route';

describe('bank-accounts sync from Buildium route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue({ id: 'user-1' });
    mocks.getSupabaseServerClient.mockReturnValue({});
    mocks.requireOrgMember.mockResolvedValue(undefined);
    mocks.buildiumFetch.mockResolvedValue({ ok: true, json: [], status: 200 });
    mocks.requireBuildiumEnabledOr403.mockResolvedValue('org-1');
  });

  it('returns 403 when Buildium guard denies access', async () => {
    const disabled = NextResponse.json({ error: 'disabled' }, { status: 403 });
    mocks.requireBuildiumEnabledOr403.mockResolvedValueOnce(disabled);
    const req = new NextRequest('http://localhost/api/bank-accounts/sync/from-buildium', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mocks.buildiumFetch).not.toHaveBeenCalled();
  });
});
