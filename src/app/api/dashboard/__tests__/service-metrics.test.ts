import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/auth/org-access', () => ({
  userHasOrgAccess: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { requireAuth } from '@/lib/auth/guards';
import { userHasOrgAccess } from '@/lib/auth/org-access';
import * as ServiceMetricsRoute from '../[orgId]/service-metrics/route';

type TableData = Record<string, any[]>;
type CallRecord = { table: string; method: string; args?: any[] };

const createSupabaseMock = (tableData: TableData) => {
  const calls: CallRecord[] = [];

  const makeChain = (table: string) => {
    const promise = Promise.resolve({ data: tableData[table] ?? [], error: null });
    const chain: any = {
      select: (...args: any[]) => {
        calls.push({ table, method: 'select', args });
        return chain;
      },
      eq: (...args: any[]) => {
        calls.push({ table, method: 'eq', args });
        return chain;
      },
      gte: (...args: any[]) => {
        calls.push({ table, method: 'gte', args });
        return chain;
      },
      lte: (...args: any[]) => {
        calls.push({ table, method: 'lte', args });
        return chain;
      },
      order: (...args: any[]) => {
        calls.push({ table, method: 'order', args });
        return chain;
      },
      limit: (...args: any[]) => {
        calls.push({ table, method: 'limit', args });
        return chain;
      },
      or: (...args: any[]) => {
        calls.push({ table, method: 'or', args });
        return chain;
      },
      in: (...args: any[]) => {
        calls.push({ table, method: 'in', args });
        return chain;
      },
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
      finally: promise.finally.bind(promise),
    };
    return chain;
  };

  const supabase = {
    from: (table: string) => {
      calls.push({ table, method: 'from' });
      return makeChain(table);
    },
  } as any;

  return { supabase, calls };
};

const createRequest = (url: string) => new NextRequest(url);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('GET /api/dashboard/[orgId]/service-metrics', () => {
  it('rejects access when user is not a member of the org', async () => {
    const supabaseMock = createSupabaseMock({});
    vi.mocked(requireAuth).mockResolvedValue({
      supabase: supabaseMock.supabase,
      user: { id: 'user-1' },
      roles: ['org_admin'],
    } as any);
    vi.mocked(userHasOrgAccess).mockResolvedValue(false);

    const response = await ServiceMetricsRoute.GET(
      createRequest('https://example.com/api/dashboard/org-1/service-metrics'),
      { params: { orgId: 'org-1' } },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body?.error?.code).toBe('ORG_FORBIDDEN');
  });

  it('applies property filters to profitability, revenue, and utilization queries', async () => {
    const tableData: TableData = {
      v_service_profitability: [],
      v_service_revenue_by_property: [],
      property_service_pricing: [],
      properties: [],
      units: [],
      service_offerings: [],
    };
    const supabaseMock = createSupabaseMock(tableData);
    vi.mocked(requireAuth).mockResolvedValue({
      supabase: supabaseMock.supabase,
      user: { id: 'user-1' },
      roles: ['org_admin'],
    } as any);
    vi.mocked(userHasOrgAccess).mockResolvedValue(true);

    await ServiceMetricsRoute.GET(
      createRequest('https://example.com/api/dashboard/org-1/service-metrics?propertyId=prop-1'),
      { params: { orgId: 'org-1' } },
    );

    const eqCalls = supabaseMock.calls.filter((c) => c.method === 'eq');
    const profitabilityFilter = eqCalls.find(
      (c) => c.table === 'v_service_profitability' && c.args?.[0] === 'property_id',
    );
    const revenueFilter = eqCalls.find(
      (c) => c.table === 'v_service_revenue_by_property' && c.args?.[0] === 'property_id',
    );
    const utilizationFilter = eqCalls.find(
      (c) => c.table === 'property_service_pricing' && c.args?.[0] === 'property_id',
    );

    expect(profitabilityFilter?.args?.[1]).toBe('prop-1');
    expect(revenueFilter?.args?.[1]).toBe('prop-1');
    expect(utilizationFilter?.args?.[1]).toBe('prop-1');
  });

  it('calculates utilization using active vs total counts', async () => {
    const tableData: TableData = {
      v_service_profitability: [],
      v_service_revenue_by_offering: [],
      property_service_pricing: [
        {
          offering_id: 'o-1',
          property_id: 'prop-1',
          unit_id: null,
          is_active: true,
          effective_start: '2024-01-01T00:00:00.000Z',
          effective_end: null,
          service_offerings: { id: 'o-1', name: 'Offering One', category: 'Cat' },
          properties: { org_id: 'org-1' },
        },
      ],
      properties: [{ id: 'prop-1' }, { id: 'prop-2' }],
      units: [],
      service_offerings: [{ id: 'o-1', name: 'Offering One', category: 'Cat' }],
    };
    const supabaseMock = createSupabaseMock(tableData);
    vi.mocked(requireAuth).mockResolvedValue({
      supabase: supabaseMock.supabase,
      user: { id: 'user-1' },
      roles: ['org_admin'],
    } as any);
    vi.mocked(userHasOrgAccess).mockResolvedValue(true);

    const response = await ServiceMetricsRoute.GET(
      createRequest('https://example.com/api/dashboard/org-1/service-metrics?type=utilization'),
      { params: { orgId: 'org-1' } },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body?.data?.utilization?.[0]).toMatchObject({
      offering_id: 'o-1',
      total_properties: 2,
      active_properties: 1,
      utilization_rate: 50,
    });
  });
});
