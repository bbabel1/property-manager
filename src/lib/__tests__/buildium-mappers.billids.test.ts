import { describe, expect, it } from 'vitest';
import { mapPaymentApplicationsToBuildium } from '../buildium-mappers';

function mockSupabase(rows: any[]) {
  return {
    from(_table: string) {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        in() {
          return this;
        },
        async then(resolve: any) {
          resolve({ data: rows, error: null });
        },
      };
    },
  } as any;
}

describe('mapPaymentApplicationsToBuildium', () => {
  it('returns bill ids and allocations when buildium_bill_id is present', async () => {
    const supabase = mockSupabase([
      {
        applied_amount: 100,
        bill_transaction_id: 'bill-1',
        bill: { id: 'bill-1', buildium_bill_id: 123 },
      },
      {
        applied_amount: 50,
        bill_transaction_id: 'bill-2',
        bill: { id: 'bill-2', buildium_bill_id: 456 },
      },
    ]);

    const result = await mapPaymentApplicationsToBuildium('pay-1', supabase);
    expect(result.billIds.sort()).toEqual([123, 456]);
    expect(result.allocations).toEqual(
      expect.arrayContaining([
        { billId: 123, amount: 100 },
        { billId: 456, amount: 50 },
      ]),
    );
  });

  it('returns empty when no buildium_bill_id', async () => {
    const supabase = mockSupabase([
      {
        applied_amount: 100,
        bill_transaction_id: 'bill-1',
        bill: { id: 'bill-1', buildium_bill_id: null },
      },
    ]);
    const result = await mapPaymentApplicationsToBuildium('pay-1', supabase);
    expect(result.billIds).toEqual([]);
    expect(result.allocations).toEqual([]);
  });
});
