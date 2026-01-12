import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireOrgMember: vi.fn(),
  testBuildiumConnection: vi.fn(),
  getBuildiumOrgIdOr403: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/auth/org-guards', () => ({
  requireOrgMember: mocks.requireOrgMember,
}));

vi.mock('@/lib/buildium/credentials-manager', () => ({
  testBuildiumConnection: mocks.testBuildiumConnection,
}));

vi.mock('@/lib/buildium-route-guard', () => ({
  getBuildiumOrgIdOr403: mocks.getBuildiumOrgIdOr403,
}));

// Import the handler after mocks are registered
import { POST } from '../route';

describe('Buildium integration status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ supabase: {}, user: { id: 'user-1' } });
    mocks.requireOrgMember.mockResolvedValue(undefined);
    mocks.testBuildiumConnection.mockResolvedValue({ success: true });
    mocks.getBuildiumOrgIdOr403.mockResolvedValue({ orgId: 'org-1' });
  });

  it('returns 403 when Buildium is disabled', async () => {
    const disabledResponse = new Response(JSON.stringify({ error: 'disabled' }), { status: 403 });
    mocks.getBuildiumOrgIdOr403.mockResolvedValueOnce({ response: disabledResponse });
    const request = new NextRequest('http://localhost/api/buildium/integration/status', {
      method: 'POST',
    });

    const res = await POST(request);

    expect(res.status).toBe(403);
    expect(mocks.testBuildiumConnection).not.toHaveBeenCalled();
  });

  it('returns success when Buildium is enabled', async () => {
    const request = new NextRequest('http://localhost/api/buildium/integration/status', {
      method: 'POST',
    });
    mocks.testBuildiumConnection.mockResolvedValueOnce({ success: true });

    const res = await POST(request);

    expect(mocks.getBuildiumOrgIdOr403).toHaveBeenCalled();
    expect(mocks.requireOrgMember).toHaveBeenCalledWith({ client: {}, userId: 'user-1', orgId: 'org-1' });
    expect(mocks.testBuildiumConnection).toHaveBeenCalledWith('org-1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success?: boolean };
    expect(body.success).toBe(true);
  });
});
