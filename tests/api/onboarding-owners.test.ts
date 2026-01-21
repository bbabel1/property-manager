import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuthMock = vi.fn();
const resolveOrgIdFromRequestMock = vi.fn();
const requireOrgMemberMock = vi.fn();

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: (...args: any[]) => requireAuthMock(...args),
}));

vi.mock('@/lib/org/resolve-org-id', () => ({
  resolveOrgIdFromRequest: (...args: any[]) => resolveOrgIdFromRequestMock(...args),
}));

vi.mock('@/lib/auth/org-guards', () => ({
  requireOrgMember: (...args: any[]) => requireOrgMemberMock(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

type OnboardingRow = {
  id: string;
  property_id: string;
  org_id: string;
  status: string;
  current_stage: Record<string, unknown>;
};

const createQueryStub = (data: unknown) => {
  const stub: any = {
    select: () => stub,
    eq: () => stub,
    in: () => stub,
    single: async () => ({ data, error: null }),
    maybeSingle: async () => ({ data, error: null }),
    delete: () => stub,
    upsert: () => stub,
    insert: () => stub,
    update: () => stub,
  };
  return stub;
};

const createSupabaseStub = (onboarding: OnboardingRow) => {
  return {
    from: (table: string) => {
      if (table === 'property_onboarding') return createQueryStub(onboarding);
      return createQueryStub(null);
    },
  };
};

describe('POST /api/onboarding/:id/owners validation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    resolveOrgIdFromRequestMock.mockResolvedValue('org-1');
    requireOrgMemberMock.mockResolvedValue(undefined);
  });

  it('rejects duplicate clientRowId values', async () => {
    const onboardingRow: OnboardingRow = {
      id: 'onb-1',
      property_id: 'prop-1',
      org_id: 'org-1',
      status: 'DRAFT',
      current_stage: {},
    };
    requireAuthMock.mockResolvedValue({
      supabase: createSupabaseStub(onboardingRow),
      user: { id: 'user-1' },
    });

    const route = await import('@/app/api/onboarding/[id]/owners/route');
    const res = await route.POST(
      new Request('http://localhost/api/onboarding/onb-1/owners', {
        method: 'POST',
        body: JSON.stringify({
          owners: [
            {
              clientRowId: '11111111-1111-4111-8111-111111111111',
              ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              ownershipPercentage: 50,
              disbursementPercentage: 50,
              primary: true,
              signerEmail: 'alice@example.com',
            },
            {
              clientRowId: '11111111-1111-4111-8111-111111111111',
              ownerId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
              ownershipPercentage: 50,
              disbursementPercentage: 50,
              primary: false,
              signerEmail: 'bob@example.com',
            },
          ],
        }),
      }) as any,
      { params: Promise.resolve({ id: 'onb-1' }) } as any,
    );

    const json = await res.json();
    if (res.status !== 422) {
      // Provide debugging context if the validation short-circuits unexpectedly
      // eslint-disable-next-line no-console
      console.error('duplicate clientRowId response', res.status, json);
    }
    expect(res.status).toBe(422);
    expect(json?.error?.code).toBe('DUPLICATE_OWNER_CLIENT_ROW_ID');
  });

  it('rejects remapping an existing clientRowId to a different owner', async () => {
    const onboardingRow: OnboardingRow = {
      id: 'onb-2',
      property_id: 'prop-2',
      org_id: 'org-1',
      status: 'DRAFT',
      current_stage: {
        ownerClientRowMap: {
          '22222222-2222-4222-8222-222222222222': '99999999-9999-4999-8999-999999999999',
        },
      },
    };
    requireAuthMock.mockResolvedValue({
      supabase: createSupabaseStub(onboardingRow),
      user: { id: 'user-1' },
    });

    const route = await import('@/app/api/onboarding/[id]/owners/route');
    const res = await route.POST(
      new Request('http://localhost/api/onboarding/onb-2/owners', {
        method: 'POST',
        body: JSON.stringify({
          owners: [
            {
              clientRowId: '22222222-2222-4222-8222-222222222222',
              ownerId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              ownershipPercentage: 100,
              disbursementPercentage: 100,
              primary: true,
              signerEmail: 'alice@example.com',
            },
          ],
        }),
      }) as any,
      { params: Promise.resolve({ id: 'onb-2' }) } as any,
    );

    const json = await res.json();
    if (res.status !== 422) {
      // eslint-disable-next-line no-console
      console.error('mismatched clientRowId response', res.status, json);
    }
    expect(res.status).toBe(422);
    expect(json?.error?.code).toBe('OWNER_CLIENT_ROW_ID_MISMATCH');
  });
});
