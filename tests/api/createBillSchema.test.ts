import { describe, expect, it } from 'vitest';

import { CreateBillSchema } from '@/app/api/bills/route';

describe('CreateBillSchema', () => {
  const basePayload = {
    bill_date: '2025-11-09',
    due_date: '2025-11-16',
    vendor_id: '42',
    post_to_account_id: 'ap-1',
    property_id: null,
    unit_id: null,
    terms: 'due_on_receipt',
    reference_number: 'INV-12345',
    memo: 'Roof repair',
    apply_markups: false,
    lines: [
      {
        id: 'line-1',
        property_id: null,
        unit_id: null,
        gl_account_id: '500',
        description: 'Labor',
        amount: 1200,
      },
    ],
  };

  it('accepts a well-formed payload', () => {
    const result = CreateBillSchema.safeParse({
      ...basePayload,
      terms: 'due_on_receipt',
    });
    expect(result.success).toBe(true);
  });

  it('rejects payloads without vendor', () => {
    const result = CreateBillSchema.safeParse({
      ...basePayload,
      vendor_id: '',
      terms: 'due_on_receipt',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toContain('vendor_id');
    }
  });

  it('requires at least one line with a positive amount', () => {
    const result = CreateBillSchema.safeParse({
      ...basePayload,
      terms: 'due_on_receipt',
      lines: [
        { id: 'empty', gl_account_id: '500', description: '', amount: 0, property_id: null, unit_id: null },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path[0]).toBe('lines');
    }
  });
});

