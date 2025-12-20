import { describe, expect, it, vi } from 'vitest';
import { buildStatementFinancialSummary, assertStatementTotalsWithSummary } from '../statement-summary';

describe('buildStatementFinancialSummary', () => {
  it('computes net to owner with expected sign conventions', () => {
    const summary = buildStatementFinancialSummary({
      totalCharges: 2000,
      totalCredits: 0,
      totalPayments: 2000,
      totalBills: 500,
      escrowAmount: 0,
      managementFees: 250,
      ownerDraw: 1250,
      previousLeaseBalance: 0,
    });

    expect(summary.ownerDraw).toBe(1250);
    expect(summary.netToOwner).toBe(0);
    expect(summary.balance).toBe(0);
  });
});

describe('assertStatementTotalsWithSummary', () => {
  it('warns when totals diverge', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const summary = buildStatementFinancialSummary({
      totalCharges: 2000,
      totalCredits: 0,
      totalPayments: 2000,
      totalBills: 500,
      escrowAmount: 0,
      managementFees: 250,
      ownerDraw: 1250,
      previousLeaseBalance: 0,
    });

    assertStatementTotalsWithSummary(summary, 1000, -100, 0);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
