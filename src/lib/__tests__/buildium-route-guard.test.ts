import { describe, expect, it, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requireBuildiumEnabledOr403, requireBuildiumEnabledOrThrow } from '@/lib/buildium-route-guard';

const mocks = vi.hoisted(() => {
  class MockBuildiumDisabledError extends Error {}
  return {
    requireAuth: vi.fn(),
    resolveOrgIdFromRequest: vi.fn(),
    assertBuildiumEnabled: vi.fn(),
    MockBuildiumDisabledError,
  };
});

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/org/resolve-org-id', () => ({
  resolveOrgIdFromRequest: mocks.resolveOrgIdFromRequest,
}));

vi.mock('@/lib/buildium-gate', () => ({
  assertBuildiumEnabled: mocks.assertBuildiumEnabled,
  BuildiumDisabledError: mocks.MockBuildiumDisabledError,
}));

describe('buildium-route-guard helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mocks.resolveOrgIdFromRequest.mockResolvedValue('org-1');
    mocks.assertBuildiumEnabled.mockResolvedValue(undefined);
  });

  it('returns orgId when enabled', async () => {
    const request = new NextRequest('http://localhost/api/buildium/example');

    const orgId = await requireBuildiumEnabledOrThrow(request);

    expect(orgId).toBe('org-1');
    expect(mocks.requireAuth).toHaveBeenCalled();
    expect(mocks.resolveOrgIdFromRequest).toHaveBeenCalledWith(request, 'user-1');
    expect(mocks.assertBuildiumEnabled).toHaveBeenCalledWith('org-1', request.url);
  });

  it('returns 403 response when disabled', async () => {
    const request = new NextRequest('http://localhost/api/buildium/example');
    mocks.assertBuildiumEnabled.mockRejectedValueOnce(new mocks.MockBuildiumDisabledError('disabled'));

    const result = await requireBuildiumEnabledOr403(request);

    expect(result).toBeInstanceOf(Response);
    const response = result as Response;
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('BUILDIUM_DISABLED');
  });
});
