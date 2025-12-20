import { describe, expect, it } from 'vitest';

import { daysInUtcMonth, prorationFirstMonth, prorationLastMonth } from '../proration';

describe('proration helpers', () => {
  it('calculates month length with leap-year support', () => {
    expect(daysInUtcMonth(2024, 1)).toBe(29);
    expect(daysInUtcMonth(2023, 1)).toBe(28);
    expect(daysInUtcMonth(2024, 0)).toBe(31);
  });

  it('prorates first-month charges from start date through end of month', () => {
    expect(prorationFirstMonth(1500, '2024-02-10')).toBeCloseTo(1034.48, 2);
    expect(prorationFirstMonth(2000, '2024-03-01')).toBeCloseTo(2000, 2);
  });

  it('returns zero for invalid first-month inputs', () => {
    expect(prorationFirstMonth(1200, 'invalid-date')).toBe(0);
  });

  it('prorates last-month charges up to the lease end date', () => {
    expect(prorationLastMonth(1500, '2024-02-10')).toBeCloseTo(517.24, 2);
    expect(prorationLastMonth(1500, '2024-02-29')).toBe(0);
  });

  it('returns zero for invalid last-month inputs', () => {
    expect(prorationLastMonth(1200, 'bad-date')).toBe(0);
  });
});
