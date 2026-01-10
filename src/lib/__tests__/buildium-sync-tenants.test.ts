import { describe, expect, it, beforeEach, vi } from 'vitest';

// Shared references for mocks
const tenantsUpdates: Array<{ payload: any; col: string; val: any }> = [];
const leaseContactsDataRef: { value: any[] } = { value: [] };

vi.mock('@/lib/db', () => {
  const supabase = {
    from: (table: string) => {
      if (table === 'tenants') {
        return {
          update: (payload: any) => ({
            eq: (col: string, val: any) => {
              tenantsUpdates.push({ payload, col, val });
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === 'lease_contacts') {
        return {
          select: (_sel: string) => ({
            eq: (_col: string, _val: any) =>
              Promise.resolve({
                data: leaseContactsDataRef.value,
                error: null,
              }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      };
    },
  };

  return {
    supabase,
    supabaseAdmin: null,
  };
});

const edgeClientStub = {
  createTenantInBuildium: vi.fn(),
  listTenantsFromBuildium: vi.fn(),
};

vi.mock('@/lib/buildium-edge-client', () => ({
  getOrgScopedBuildiumEdgeClient: vi.fn(async () => edgeClientStub),
}));

// Subject under test (after mocks)
import { buildiumSync } from '../buildium-sync';
import { supabase } from '@/lib/db';

describe('ensureBuildiumTenantId', () => {
  beforeEach(() => {
    tenantsUpdates.length = 0;
    leaseContactsDataRef.value = [];
    edgeClientStub.createTenantInBuildium.mockReset();
    edgeClientStub.listTenantsFromBuildium.mockReset();
  });

  const baseContact = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    primaryAddress: {
      AddressLine1: '123 St',
      City: 'City',
      State: 'ST',
      PostalCode: '00000',
      Country: 'UnitedStates',
    },
  };

  it('creates a tenant via Buildium client and persists id locally', async () => {
    const makeRequest = vi.fn().mockImplementation((method: string) => {
      if (method === 'GET') return [];
      if (method === 'POST') return { Id: 123 };
      throw new Error('unexpected call');
    });

    const id = await (buildiumSync as any).ensureBuildiumTenantId(
      { id: 'tenant-1' },
      { ...baseContact },
      supabase,
      { makeRequest },
      'org-1',
    );

    expect(id).toBe(123);
    expect(makeRequest).toHaveBeenCalledWith('POST', '/rentals/tenants', expect.any(Object));
    expect(tenantsUpdates).toHaveLength(1);
    expect(tenantsUpdates[0]).toMatchObject({
      payload: expect.objectContaining({ buildium_tenant_id: 123 }),
      col: 'id',
      val: 'tenant-1',
    });
  });

  it('reuses an existing Buildium tenant when email matches and skips create', async () => {
    const makeRequest = vi.fn().mockImplementation((method: string, url: string) => {
      if (method === 'GET' && url.includes('/rentals/tenants?')) {
        return [{ Id: 555, Email: baseContact.email }];
      }
      throw new Error('unexpected call');
    });

    const id = await (buildiumSync as any).ensureBuildiumTenantId(
      { id: 'tenant-2' },
      { ...baseContact },
      supabase,
      { makeRequest },
      'org-1',
    );

    expect(id).toBe(555);
    // Only list call, no POST
    expect(makeRequest).toHaveBeenCalledTimes(1);
    expect(tenantsUpdates).toHaveLength(1);
    expect(tenantsUpdates[0].payload.buildium_tenant_id).toBe(555);
  });

  it('handles duplicate errors by falling back to lookup and persisting match', async () => {
    let calls = 0;
    const makeRequest = vi.fn().mockImplementation((method: string, url: string) => {
      if (method === 'GET' && url.includes('/rentals/tenants?')) {
        calls += 1;
        if (calls === 1) return []; // initial lookup
        return [{ Id: 777, Email: baseContact.email }];
      }
      if (method === 'POST') {
        throw new Error('409 duplicate');
      }
      throw new Error('unexpected call');
    });

    const id = await (buildiumSync as any).ensureBuildiumTenantId(
      { id: 'tenant-3' },
      { ...baseContact },
      supabase,
      { makeRequest },
      'org-1',
    );

    expect(id).toBe(777);
    expect(makeRequest).toHaveBeenCalledWith('POST', '/rentals/tenants', expect.any(Object));
    expect(tenantsUpdates[0].payload.buildium_tenant_id).toBe(777);
  });
});

describe('persistBuildiumTenantIdsFromLease', () => {
  beforeEach(() => {
    tenantsUpdates.length = 0;
    leaseContactsDataRef.value = [];
  });

  it('maps Buildium lease tenant IDs back to local lease_contacts/tenants', async () => {
    leaseContactsDataRef.value = [
      {
        id: 'lc-1',
        role: 'tenant',
        tenant_id: 'tenant-10',
        tenants: {
          buildium_tenant_id: null,
          contact: {
            primary_email: 'match@example.com',
            first_name: 'Alice',
            last_name: 'Tenant',
            is_company: false,
          },
        },
      },
    ];

    const buildiumLease = {
      Id: 900,
      Tenants: [
        {
          Id: 314,
          Email: 'match@example.com',
          FirstName: 'Alice',
          LastName: 'Tenant',
        },
      ],
    } as any;

    await (buildiumSync as any).persistBuildiumTenantIdsFromLease(1, buildiumLease, 'org-1');

    expect(tenantsUpdates).toHaveLength(1);
    expect(tenantsUpdates[0]).toMatchObject({
      payload: expect.objectContaining({ buildium_tenant_id: 314 }),
      val: 'tenant-10',
    });
  });
});
