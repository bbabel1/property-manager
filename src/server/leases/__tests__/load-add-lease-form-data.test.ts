import { describe, expect, it } from 'vitest';

import { sanitizeAddLeasePrefillParams } from '../load-add-lease-form-data';

const allowed = {
  propertyIds: new Set(['p1', 'p2']),
  unitIds: new Set(['u1', 'u2']),
  tenantIds: new Set(['t1', 't2']),
};

describe('sanitizeAddLeasePrefillParams', () => {
  it('keeps allowed property/unit and normalizes amounts/dates', () => {
    const result = sanitizeAddLeasePrefillParams(
      {
        propertyId: 'p1',
        unit: 'u2',
        from: '2024/01/02',
        to: '2024-12-31',
        rent: '$1,250.55',
        rentCycle: 'monthly',
        nextDueDate: '2024-01-05',
        deposit: '300',
        depositDate: '2024-01-06',
        memo: 'Rent memo',
        leaseCharges: 'Notes',
      },
      allowed,
    );

    expect(result.propertyId).toBe('p1');
    expect(result.unitId).toBe('u2');
    expect(result.from).toBe('2024-01-02');
    expect(result.to).toBe('2024-12-31');
    expect(result.rent).toBe(1250.55);
    expect(result.rentCycle).toBe('Monthly');
    expect(result.nextDueDate).toBe('2024-01-05');
    expect(result.depositAmt).toBe(300);
    expect(result.depositDate).toBe('2024-01-06');
    expect(result.rentMemo).toBe('Rent memo');
    expect(result.leaseCharges).toBe('Notes');
  });

  it('drops invalid ids and bad values', () => {
    const result = sanitizeAddLeasePrefillParams(
      {
        propertyId: 'p3',
        unit: 'u9',
        from: 'bad-date',
        rent: 'oops',
        rentCycle: 'never',
        deposit: 'nope',
        depositMemo: '',
        leaseCharges: 'x'.repeat(5000),
      },
      allowed,
    );

    expect(result.propertyId).toBeNull();
    expect(result.unitId).toBeNull();
    expect(result.from).toBeNull();
    expect(result.rent).toBeNull();
    expect(result.rentCycle).toBeUndefined();
    expect(result.depositAmt).toBeNull();
    expect(result.depositMemo).toBeNull();
    expect(result.leaseCharges).toBeNull();
  });

  it('supports alternate param names', () => {
    const result = sanitizeAddLeasePrefillParams(
      {
        property: 'p2',
        unitId: 'u1',
        start: '2024-02-01',
        end: '2025-01-31',
        rentMemo: '  trim me ',
        notes: 'hello',
      },
      allowed,
    );

    expect(result.propertyId).toBe('p2');
    expect(result.unitId).toBe('u1');
    expect(result.from).toBe('2024-02-01');
    expect(result.to).toBe('2025-01-31');
    expect(result.rentMemo).toBe('trim me');
    expect(result.leaseCharges).toBe('hello');
  });
});
