import { describe, it, expect, vi, beforeEach } from 'vitest';

const requireAuthMock = vi.fn();
vi.mock('@/lib/auth/guards', () => ({
  requireAuth: () => requireAuthMock(),
}));

const loggerMock = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};
vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

function makeSupabaseAdmin(overrides: any = {}) {
  const bills = overrides.bills ?? [
    { id: 'bill-1', org_id: 'org-1', vendor_id: 'vendor-1', property_id: null, unit_id: null },
  ];
  const bank = overrides.bank ?? { id: 'bank-1', org_id: 'org-1', is_bank_account: true };
  const createdPaymentId = overrides.paymentId ?? 'pay-1';
  const sourceReconciled = overrides.sourceReconciled ?? false;
  const validateError = overrides.validateError ?? null;
  const billApplicationId = overrides.applicationId ?? 'app-1';
  const creditTx = overrides.creditTx ?? {
    id: 'credit-1',
    org_id: 'org-1',
    transaction_type: 'VendorCredit',
    total_amount: 100,
    is_reconciled: false,
  };
  const appBill = overrides.appBill ?? { id: 'bill-1', org_id: 'org-1', transaction_type: 'Bill' };

  return {
    rpc: vi.fn(async (fn: string) => {
      if (fn === 'resolve_ap_gl_account_id') return { data: 'ap-1', error: null };
      if (fn === 'validate_bill_application') {
        return { data: null, error: validateError };
      }
      if (fn === 'post_transaction') {
        return { data: createdPaymentId, error: null };
      }
      return { data: null, error: null };
    }),
    from: vi.fn((table: string) => {
      const builder: any = {
        _singleResp: { data: null, error: null },
        select: vi.fn(() => builder),
        in: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        not: vi.fn(() => builder),
        range: vi.fn(() => builder),
        order: vi.fn(() => builder),
        maybeSingle: vi.fn(async () => builder._singleResp),
        insert: vi.fn(() => builder),
        update: vi.fn(() => builder),
        delete: vi.fn(() => builder),
      };

      if (table === 'transactions') {
        builder.select.mockImplementation(() => builder);
        builder.in.mockImplementation(() => builder);
        builder.eq.mockImplementation((col: string, value: any) => {
          if (col === 'transaction_type') {
            return Promise.resolve({ data: bills, error: null });
          }
          if (col === 'id') {
            const valStr = String(value ?? '');
            if (valStr.startsWith('bill-')) {
              builder._singleResp = { data: appBill, error: null };
              return builder;
            }
            if (valStr.startsWith('credit-')) {
              builder._singleResp = { data: creditTx, error: null };
              return builder;
            }
            builder._singleResp = {
              data: { id: createdPaymentId, is_reconciled: sourceReconciled, org_id: appBill.org_id },
              error: null,
            };
            return builder;
          }
          return builder;
        });
        builder._singleResp = { data: creditTx, error: null };
        builder.maybeSingle.mockImplementation(async () => builder._singleResp);
        builder.insert.mockImplementation(() => builder);
        builder.delete.mockImplementation(() => ({ eq: () => Promise.resolve({ error: null }) }));
      }

      if (table === 'gl_accounts') {
        builder.select.mockImplementation(() => builder);
        builder.eq.mockImplementation(() => builder);
        builder._singleResp = { data: bank, error: null };
        builder.maybeSingle.mockImplementation(async () => builder._singleResp);
      }

      if (table === 'bill_applications') {
        builder.insert.mockImplementation(() => ({
          select: () => ({
            maybeSingle: async () => ({ data: { id: billApplicationId }, error: null }),
          }),
        }));
        builder.delete.mockImplementation(() => builder);
        builder.eq.mockImplementation(() => builder);
      }

      if (table === 'vendors') {
        builder.select.mockImplementation(() => builder);
        builder.eq.mockImplementation(() => builder);
        builder._singleResp = {
          data: { id: 'vendor-1', org_id: 'org-1', buildium_vendor_id: 1234 },
          error: null,
        };
        builder.maybeSingle.mockImplementation(async () => builder._singleResp);
      }

      if (table === 'properties') {
        builder.select.mockImplementation(() => builder);
        builder.eq.mockImplementation(() => builder);
        builder._singleResp = { data: null, error: null };
        builder.maybeSingle.mockImplementation(async () => builder._singleResp);
      }

      return builder;
    }),
  };
}

describe('AP integration (route-level happy/guard paths)', () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuthMock.mockResolvedValue({ user: { id: 'user-1' }, roles: ['org_admin'] });
  });

  it('POST /api/payments returns 201 on happy path', async () => {
    const supabaseAdmin = makeSupabaseAdmin();
    vi.doMock('@/lib/db', () => ({ supabaseAdmin }));
    const route = await import('@/app/api/payments/route');
    const res = await route.POST(
      new Request('http://localhost/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          bank_account_id: 'bank-1',
          amount: 50,
          payment_date: '2025-01-01',
          bill_allocations: [{ bill_id: 'bill-1', amount: 50 }],
        }),
      }) as any,
    );
    expect(res.status).toBe(201);
  });

  it('POST /api/payments returns 409 when source payment is reconciled', async () => {
    const supabaseAdmin = makeSupabaseAdmin({ sourceReconciled: true });
    vi.doMock('@/lib/db', () => ({ supabaseAdmin }));
    const route = await import('@/app/api/payments/route');
    const res = await route.POST(
      new Request('http://localhost/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          bank_account_id: 'bank-1',
          amount: 50,
          payment_date: '2025-01-01',
          bill_allocations: [{ bill_id: 'bill-1', amount: 50 }],
        }),
      }) as any,
    );
    expect(res.status).toBe(409);
  });

  it('POST /api/vendor-credits/[id]/apply returns 409 when credit is reconciled', async () => {
    const supabaseAdmin = makeSupabaseAdmin({
      creditTx: {
        id: 'credit-1',
        org_id: 'org-1',
        transaction_type: 'VendorCredit',
        total_amount: 100,
        is_reconciled: true,
      },
    });
    vi.doMock('@/lib/db', () => ({ supabaseAdmin }));
    const route = await import('@/app/api/vendor-credits/[id]/apply/route');
    const res = await route.POST(
      new Request('http://localhost/api/vendor-credits/credit-1/apply', {
        method: 'POST',
        body: JSON.stringify({
          bill_allocations: [{ bill_id: 'bill-1', amount: 10 }],
        }),
      }) as any,
      { params: Promise.resolve({ id: 'credit-1' }) },
    );
    expect(res.status).toBe(409);
  });

  it('POST /api/bills/[id]/applications returns 422 on validation error and 409 on reconciled source', async () => {
    const supabaseAdmin = makeSupabaseAdmin({
      validateError: { message: 'validation failed' },
      appBill: { id: 'bill-1', org_id: 'org-1', transaction_type: 'Bill' },
    });
    vi.doMock('@/lib/db', () => ({ supabaseAdmin }));
    const route = await import('@/app/api/bills/[id]/applications/route');
    const res422 = await route.POST(
      new Request('http://localhost/api/bills/bill-1/applications', {
        method: 'POST',
        body: JSON.stringify({
          source_transaction_id: 'pay-1',
          applied_amount: 10,
        }),
      }) as any,
      { params: Promise.resolve({ id: 'bill-1' }) },
    );
    expect(res422.status).toBe(422);

    vi.resetModules();
    const supabaseAdminRecon = makeSupabaseAdmin({
      sourceReconciled: true,
      validateError: null,
      appBill: { id: 'bill-1', org_id: 'org-1', transaction_type: 'Bill' },
    });
    vi.doMock('@/lib/db', () => ({ supabaseAdmin: supabaseAdminRecon }));
    const route2 = await import('@/app/api/bills/[id]/applications/route');
    const res409 = await route2.POST(
      new Request('http://localhost/api/bills/bill-1/applications', {
        method: 'POST',
        body: JSON.stringify({
          source_transaction_id: 'pay-1',
          applied_amount: 10,
        }),
      }) as any,
      { params: Promise.resolve({ id: 'bill-1' }) },
    );
    expect(res409.status).toBe(409);
  });
});
