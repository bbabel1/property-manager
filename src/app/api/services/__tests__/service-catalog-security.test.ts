import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/org/resolve-org-id', () => ({
  resolveOrgIdFromRequest: vi.fn(),
}));

// Replace the real logger to avoid pino setup in tests
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import * as CatalogRoute from '../catalog/route';
import * as PlanDefaultsRoute from '../plan-defaults/route';

const createRequest = (url: string) => new NextRequest(url);

type SupabaseResponse = { data: any; error: any };
function createSupabaseMock(response: SupabaseResponse) {
  const responsePromise = Promise.resolve(response);
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.then = responsePromise.then.bind(responsePromise);
  chain.catch = responsePromise.catch.bind(responsePromise);
  const from = vi.fn(() => chain);
  return { supabase: { from } as any, from, chain };
}

const authUser = { id: 'user-1' };

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/services/catalog', () => {
  it('rejects unauthenticated access', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('UNAUTHENTICATED'));

    const response = await CatalogRoute.GET(createRequest('https://example.com/api/services/catalog'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body?.error?.code).toBe('UNAUTHORIZED');
    expect(resolveOrgIdFromRequest).not.toHaveBeenCalled();
  });

  it('scopes catalog queries to the resolved org', async () => {
    const supabaseMock = createSupabaseMock({
      data: [{ id: 'svc-1', name: 'Test' }],
      error: null,
    });
    vi.mocked(requireAuth).mockResolvedValue({
      supabase: supabaseMock.supabase,
      user: authUser,
      roles: ['org_admin'],
      orgRoles: {},
    } as any);
    vi.mocked(resolveOrgIdFromRequest).mockResolvedValue('org-123');

    const response = await CatalogRoute.GET(createRequest('https://example.com/api/services/catalog'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabaseMock.from).toHaveBeenCalledWith('service_offerings');
    expect(supabaseMock.chain.eq).toHaveBeenCalledWith('org_id', 'org-123');
    expect(body?.data?.[0]?.id).toBe('svc-1');
  });
});

describe('GET /api/services/plan-defaults', () => {
  it('rejects unauthenticated access', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('UNAUTHENTICATED'));

    const response = await PlanDefaultsRoute.GET(
      createRequest('https://example.com/api/services/plan-defaults'),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body?.error?.code).toBe('UNAUTHORIZED');
  });

  it('rejects access when org resolution fails', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      supabase: {} as any,
      user: authUser,
      roles: ['org_admin'],
      orgRoles: {},
    } as any);
    vi.mocked(resolveOrgIdFromRequest).mockRejectedValue(new Error('ORG_FORBIDDEN'));

    const response = await PlanDefaultsRoute.GET(
      createRequest('https://example.com/api/services/plan-defaults'),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body?.error?.code).toBe('ORG_FORBIDDEN');
  });

  it('returns plan defaults scoped to org context', async () => {
    const supabaseMock = createSupabaseMock({
      data: [
        {
          service_plan: 'Full',
          offering_id: 'svc-1',
          billing_basis: 'percent_rent',
          default_rate: 5,
          plan_fee_percent: 4,
          min_monthly_fee: 100,
          service_offerings: { name: 'Test Offering' },
        },
      ],
      error: null,
    });
    vi.mocked(requireAuth).mockResolvedValue({
      supabase: supabaseMock.supabase,
      user: authUser,
      roles: ['org_admin'],
      orgRoles: {},
    } as any);
    vi.mocked(resolveOrgIdFromRequest).mockResolvedValue('org-123');

    const response = await PlanDefaultsRoute.GET(
      createRequest('https://example.com/api/services/plan-defaults'),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(supabaseMock.from).toHaveBeenCalledWith('service_plan_default_pricing');
    expect(supabaseMock.chain.eq).toHaveBeenCalledWith('org_id', 'org-123');
    expect(body?.data?.[0]).toMatchObject({
      service_plan: 'Full',
      offering_id: 'svc-1',
      offering_name: 'Test Offering',
      plan_fee_percent: 4,
      min_monthly_fee: 100,
    });
  });
});
