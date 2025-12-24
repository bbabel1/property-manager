import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { TypedSupabaseClient } from '@/lib/db';

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-service-role';
});

const supabaseStub = {} as unknown as TypedSupabaseClient;

vi.mock('@/lib/db', () => ({
  supabase: supabaseStub,
  supabaseAdmin: supabaseStub,
}));

const { calculateServiceFee } = await import('@/lib/service-pricing');

describe('calculateServiceFee (plan-managed only)', () => {
  it('returns plan_managed_only with zero amount', async () => {
    const result = await calculateServiceFee({
      propertyId: 'prop',
      unitId: null,
      offeringId: 'offering',
      servicePlan: null,
      periodStart: '2024-01-01',
      periodEnd: '2024-01-31',
    });

    expect(result.amount).toBe(0);
    expect(result.calculationMethod).toBe('plan_managed_only');
  });
});
