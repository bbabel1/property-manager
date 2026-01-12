import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireBuildiumEnabledOr403: vi.fn(),
  requireOrgMember: vi.fn(),
  buildiumFetch: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({
  requireRole: mocks.requireRole,
}));

vi.mock('@/lib/buildium-route-guard', () => ({
  requireBuildiumEnabledOr403: mocks.requireBuildiumEnabledOr403,
}));

vi.mock('@/lib/auth/org-guards', () => ({
  requireOrgMember: mocks.requireOrgMember,
}));

vi.mock('@/lib/buildium-http', () => ({
  buildiumFetch: mocks.buildiumFetch,
}));

vi.mock('@/lib/buildium-mappers', () => ({
  mapStaffToBuildium: () => ({}),
}));

// Import after mocks
import { POST } from '../route';

describe('buildium staff sync route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1, buildium_user_id: null }, error: null }),
          update: vi.fn().mockResolvedValue({}),
        }),
      },
      user: { id: 'user-1' },
    });
    mocks.requireOrgMember.mockResolvedValue(undefined);
    mocks.requireBuildiumEnabledOr403.mockResolvedValue('org-1');
    mocks.buildiumFetch.mockResolvedValue({ ok: true, json: {}, status: 200 });
  });

  it('returns 403 when Buildium is disabled (guard returns response)', async () => {
    const disabled = NextResponse.json({ error: 'disabled' }, { status: 403 });
    mocks.requireBuildiumEnabledOr403.mockResolvedValueOnce(disabled);
    const req = new NextRequest('http://localhost/api/buildium/staff/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ staff_id: 1 }),
    });

    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(mocks.buildiumFetch).not.toHaveBeenCalled();
  });

  // Success path covered by other integration tests; here we only verify disabled guard short-circuits.
});
