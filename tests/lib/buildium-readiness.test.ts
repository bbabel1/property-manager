import { describe, it, expect } from 'vitest';
import { evaluateBuildiumReadiness } from '@/lib/buildium-readiness';

const baseProperty = {
  id: 'prop-1',
  name: 'Test Property',
  address_line1: '123 Main St',
  city: 'New York',
  state: 'NY',
  postal_code: '10001',
  country: 'United States',
  property_type: 'Condo',
  total_units: 1,
  reserve: null,
  is_active: true,
  operating_bank_account_id: 'bank-1',
};

function makeDbStub({ unitCount = 1, ownerCount = 1 }: { unitCount?: number; ownerCount?: number }) {
  return {
    from: (table: string) => {
      if (table === 'units') {
        return {
          select: () => ({
            eq: async () => ({ count: unitCount, error: null }),
          }),
        };
      }
      if (table === 'ownerships') {
        return {
          select: () => ({
            eq: async () => ({ count: ownerCount, error: null }),
          }),
        };
      }
      // properties/onboarding are not used when property is provided
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  };
}

describe('evaluateBuildiumReadiness', () => {
  it('returns ready=true when all required fields and counts are present', async () => {
    const db = makeDbStub({ unitCount: 2, ownerCount: 1 });
    const result = await evaluateBuildiumReadiness({
      db,
      propertyId: 'prop-1',
      orgId: 'org-1',
      property: baseProperty,
    });

    expect(result.ready).toBe(true);
    expect(result.issues.filter((i) => i.blocking !== false)).toHaveLength(0);
  });

  it('returns blocking issues when required fields or counts are missing', async () => {
    const db = makeDbStub({ unitCount: 0, ownerCount: 0 });
    const result = await evaluateBuildiumReadiness({
      db,
      propertyId: 'prop-1',
      orgId: 'org-1',
      property: {
        ...baseProperty,
        city: '',
        operating_bank_account_id: null,
      },
    });

    expect(result.ready).toBe(false);
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain('MISSING_ADDRESS_CITY');
    expect(codes).toContain('NO_UNITS');
    expect(codes).toContain('NO_OWNERS');
    // Bank account is non-blocking
    const bankIssue = result.issues.find((i) => i.code === 'BANK_ACCOUNT');
    expect(bankIssue?.blocking).toBe(false);
  });
});
