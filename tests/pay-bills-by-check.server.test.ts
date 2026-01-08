import { describe, it, expect, vi, beforeEach } from 'vitest';

type Fixtures = Record<string, any[]>;

function makeSupabaseClient(fixturesRef: () => Fixtures) {
  return {
    from(table: string) {
      let rows = fixturesRef()[table] || [];
      const query: any = {
        select: () => query,
        in: (column: string, values: any[]) => {
          rows = rows.filter((row) => values.includes((row as any)[column]));
          return query;
        },
        eq: (column: string, value: any) => {
          rows = rows.filter((row) => (row as any)[column] === value);
          return query;
        },
        order: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        returns: <T>() => ({ data: rows as T[], error: null }),
        then: (resolve: (value: { data: any[]; error: null }) => void) =>
          resolve({ data: rows, error: null }),
      };
      return query;
    },
  };
}

const state = vi.hoisted(() => ({
  fixtures: {} as Fixtures,
}));

vi.mock('@/lib/db', () => {
  const client = makeSupabaseClient(() => state.fixtures);
  return {
    supabase: client,
    supabaseAdmin: client,
  };
});

describe('pay-bills-by-check server helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('listUnpaidBillsForCheckPayment returns unpaid bill with insurance + bank metadata', async () => {
    const fixtures: Fixtures = {
      transactions: [
        {
          id: 'bill-1',
          org_id: 'org-1',
          vendor_id: 'vendor-1',
          buildium_bill_id: 101,
          total_amount: 100,
          status: 'Due',
          date: '2025-01-01',
          due_date: '2025-01-10',
          paid_date: null,
          transaction_type: 'Bill',
        },
      ],
      transaction_lines: [
        {
          transaction_id: 'bill-1',
          amount: 100,
          posting_type: 'Debit',
          property_id: 'prop-1',
          unit_id: null,
          properties: [
            {
              id: 'prop-1',
              name: 'Property A',
              operating_bank_gl_account_id: 'bank-1',
              org_id: 'org-1',
            },
          ],
        },
      ],
      vendors: [
        {
          id: 'vendor-1',
          insurance_expiration_date: null,
          contact: { display_name: 'Vendor One' },
        },
      ],
      properties: [{ id: 'prop-1', name: 'Property A' }],
      units: [],
      gl_accounts: [{ id: 'bank-1', buildium_gl_account_id: 201 }],
    };

    state.fixtures = fixtures;

    const { listUnpaidBillsForCheckPayment } = await import(
      '@/server/bills/pay-bills-by-check'
    );

    const bills = await listUnpaidBillsForCheckPayment({
      propertyIds: null,
      unitIds: null,
      vendorIds: null,
      statuses: null,
    });

    expect(bills).toHaveLength(1);
    const bill = bills[0];
    expect(bill.id).toBe('bill-1');
    expect(bill.remaining_amount).toBe(100);
    expect(bill.vendor_name).toBe('Vendor One');
    expect(bill.vendor_insurance_missing_or_expired).toBe(true);
    expect(bill.operating_bank_gl_account_id).toBe('bank-1');
    expect(bill.bank_has_buildium_id).toBe(true);
  });

  it('listUnpaidBillsForCheckPayment excludes fully paid bills', async () => {
    const fixtures: Fixtures = {
      transactions: [
        {
          id: 'bill-1',
          org_id: 'org-1',
          vendor_id: 'vendor-1',
          buildium_bill_id: 101,
          total_amount: 100,
          status: 'Due',
          date: '2025-01-01',
          due_date: '2025-01-10',
          paid_date: null,
          transaction_type: 'Bill',
        },
        {
          id: 'pay-1',
          bill_transaction_id: 'bill-1',
          buildium_bill_id: 101,
          total_amount: 100,
          status: 'Paid',
          date: '2025-01-05',
          due_date: null,
          paid_date: '2025-01-05',
          transaction_type: 'Payment',
        },
      ],
      transaction_lines: [
        {
          transaction_id: 'bill-1',
          amount: 100,
          posting_type: 'Debit',
          property_id: 'prop-1',
          unit_id: null,
          properties: [
            {
              id: 'prop-1',
              name: 'Property A',
              operating_bank_gl_account_id: 'bank-1',
              org_id: 'org-1',
            },
          ],
        },
        {
          transaction_id: 'pay-1',
          amount: 100,
          posting_type: 'Debit',
          property_id: 'prop-1',
          unit_id: null,
        },
      ],
      vendors: [
        {
          id: 'vendor-1',
          insurance_expiration_date: null,
          contact: { display_name: 'Vendor One' },
        },
      ],
      properties: [{ id: 'prop-1', name: 'Property A' }],
      units: [],
      gl_accounts: [{ id: 'bank-1', buildium_gl_account_id: 201 }],
    };

    state.fixtures = fixtures;

    const { listUnpaidBillsForCheckPayment } = await import(
      '@/server/bills/pay-bills-by-check'
    );

    const bills = await listUnpaidBillsForCheckPayment({
      propertyIds: null,
      unitIds: null,
      vendorIds: null,
      statuses: null,
    });

    expect(bills).toHaveLength(0);
  });

  it('getBillsForCheckPreparation computes remaining and bank account', async () => {
    const fixtures: Fixtures = {
      transactions: [
        {
          id: 'bill-1',
          org_id: 'org-1',
          vendor_id: 'vendor-1',
          buildium_bill_id: 101,
          total_amount: 200,
          status: 'Due',
          date: '2025-01-01',
          due_date: '2025-01-10',
          paid_date: null,
          transaction_type: 'Bill',
        },
        {
          id: 'pay-1',
          org_id: 'org-1',
          vendor_id: 'vendor-1',
          bill_transaction_id: 'bill-1',
          buildium_bill_id: 101,
          total_amount: 50,
          status: 'Paid',
          date: '2025-01-05',
          due_date: null,
          paid_date: '2025-01-05',
          transaction_type: 'Payment',
        },
      ],
      transaction_lines: [
        {
          transaction_id: 'bill-1',
          amount: 200,
          posting_type: 'Debit',
          property_id: 'prop-1',
          unit_id: null,
          properties: [
            {
              id: 'prop-1',
              name: 'Property A',
              operating_bank_gl_account_id: 'bank-1',
              org_id: 'org-1',
            },
          ],
        },
        {
          transaction_id: 'pay-1',
          amount: 50,
          posting_type: 'Debit',
          property_id: 'prop-1',
          unit_id: null,
        },
      ],
      vendors: [
        {
          id: 'vendor-1',
          insurance_expiration_date: null,
          contact: { display_name: 'Vendor One' },
        },
      ],
      properties: [{ id: 'prop-1', name: 'Property A' }],
      units: [],
      gl_accounts: [{ id: 'bank-1', buildium_gl_account_id: 201 }],
    };

    state.fixtures = fixtures;

    const { getBillsForCheckPreparation } = await import(
      '@/server/bills/pay-bills-by-check'
    );

    const bills = await getBillsForCheckPreparation(['bill-1']);
    expect(bills).toHaveLength(1);
    const bill = bills[0];
    expect(bill.remaining_amount).toBe(150);
    expect(bill.operating_bank_gl_account_id).toBe('bank-1');
  });

  it('listUnpaidBillsForCheckPayment falls back to properties table for operating bank account when join is missing', async () => {
    const fixtures: Fixtures = {
      transactions: [
        {
          id: 'bill-1',
          org_id: 'org-1',
          vendor_id: 'vendor-1',
          buildium_bill_id: 101,
          total_amount: 100,
          status: 'Due',
          date: '2025-01-01',
          due_date: '2025-01-10',
          paid_date: null,
          transaction_type: 'Bill',
        },
      ],
      transaction_lines: [
        {
          transaction_id: 'bill-1',
          amount: 100,
          posting_type: 'Debit',
          property_id: 'prop-1',
          unit_id: null,
        },
      ],
      vendors: [
        {
          id: 'vendor-1',
          insurance_expiration_date: null,
          contact: { display_name: 'Vendor One' },
        },
      ],
      properties: [
        {
          id: 'prop-1',
          name: 'Property A',
          operating_bank_gl_account_id: 'bank-1',
          org_id: 'org-1',
        },
      ],
      units: [],
      gl_accounts: [{ id: 'bank-1', buildium_gl_account_id: 201 }],
    };

    state.fixtures = fixtures;

    const { listUnpaidBillsForCheckPayment } = await import(
      '@/server/bills/pay-bills-by-check'
    );

    const bills = await listUnpaidBillsForCheckPayment({
      propertyIds: null,
      unitIds: null,
      vendorIds: null,
      statuses: null,
    });

    expect(bills).toHaveLength(1);
    expect(bills[0].operating_bank_gl_account_id).toBe('bank-1');
    expect(bills[0].bank_has_buildium_id).toBe(true);
  });

  it('createCheckPaymentsForBills validates and calls Buildium endpoint', async () => {
    const fixtures: Fixtures = {
      transactions: [
        {
          id: 'bill-1',
          org_id: 'org-1',
          vendor_id: 'vendor-1',
          buildium_bill_id: 101,
          total_amount: 100,
          status: 'Due',
          date: '2025-01-01',
          due_date: '2025-01-10',
          paid_date: null,
          transaction_type: 'Bill',
        },
      ],
      transaction_lines: [
        {
          transaction_id: 'bill-1',
          amount: 100,
          posting_type: 'Debit',
          property_id: 'prop-1',
          unit_id: null,
          properties: [
            {
              id: 'prop-1',
              name: 'Property A',
              operating_bank_gl_account_id: 'bank-1',
              org_id: 'org-1',
            },
          ],
        },
      ],
      vendors: [
        {
          id: 'vendor-1',
          insurance_expiration_date: null,
          contact: { display_name: 'Vendor One' },
        },
      ],
      properties: [{ id: 'prop-1', name: 'Property A' }],
      units: [],
      gl_accounts: [{ id: 'bank-1', buildium_gl_account_id: 201 }],
    };

    state.fixtures = fixtures;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    (globalThis as any).fetch = fetchMock;

    const { createCheckPaymentsForBills } = await import(
      '@/server/bills/pay-bills-by-check'
    );

    const results = await createCheckPaymentsForBills([
      {
        billId: 'bill-1',
        amount: 50,
        payDate: '2025-01-15',
        bankGlAccountId: 'bank-1',
        checkNumber: '1001',
        memo: 'Test payment',
      },
    ]);

    expect(results).toEqual([{ billId: 'bill-1', success: true }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/buildium/bills/101/payments');
    const body = JSON.parse((init as any).body as string);
    expect(body.BankAccountId).toBe(201);
    expect(body.Amount).toBe(50);
  });

  it('createCheckPaymentsForBills fails when amount exceeds remaining', async () => {
    const fixtures: Fixtures = {
      transactions: [
        {
          id: 'bill-1',
          org_id: 'org-1',
          vendor_id: 'vendor-1',
          buildium_bill_id: 101,
          total_amount: 100,
          status: 'Due',
          date: '2025-01-01',
          due_date: '2025-01-10',
          paid_date: null,
          transaction_type: 'Bill',
        },
      ],
      transaction_lines: [
        {
          transaction_id: 'bill-1',
          amount: 100,
          posting_type: 'Debit',
          property_id: 'prop-1',
          unit_id: null,
          properties: [
            {
              id: 'prop-1',
              name: 'Property A',
              operating_bank_gl_account_id: 'bank-1',
              org_id: 'org-1',
            },
          ],
        },
      ],
      vendors: [],
      properties: [{ id: 'prop-1', name: 'Property A' }],
      units: [],
      gl_accounts: [{ id: 'bank-1', buildium_gl_account_id: 201 }],
    };

    state.fixtures = fixtures;

    (globalThis as any).fetch = vi.fn();

    const { createCheckPaymentsForBills } = await import(
      '@/server/bills/pay-bills-by-check'
    );

    const results = await createCheckPaymentsForBills([
      {
        billId: 'bill-1',
        amount: 500,
        payDate: '2025-01-15',
        bankGlAccountId: 'bank-1',
      },
    ]);

    expect(results[0].success).toBe(false);
    expect(results[0].error).toMatch(/exceeds remaining/i);
  });

  it('createCheckPaymentsForBills fails when bank is missing Buildium ID', async () => {
    const fixtures: Fixtures = {
      transactions: [
        {
          id: 'bill-1',
          org_id: 'org-1',
          vendor_id: 'vendor-1',
          buildium_bill_id: 101,
          total_amount: 100,
          status: 'Due',
          date: '2025-01-01',
          due_date: '2025-01-10',
          paid_date: null,
          transaction_type: 'Bill',
        },
      ],
      transaction_lines: [
        {
          transaction_id: 'bill-1',
          amount: 100,
          posting_type: 'Debit',
          property_id: 'prop-1',
          unit_id: null,
          properties: [
            {
              id: 'prop-1',
              name: 'Property A',
              operating_bank_gl_account_id: 'bank-1',
              org_id: 'org-1',
            },
          ],
        },
      ],
      vendors: [],
      properties: [{ id: 'prop-1', name: 'Property A' }],
      units: [],
      gl_accounts: [{ id: 'bank-1', buildium_gl_account_id: null }],
    };

    state.fixtures = fixtures;

    (globalThis as any).fetch = vi.fn();

    const { createCheckPaymentsForBills } = await import(
      '@/server/bills/pay-bills-by-check'
    );

    const results = await createCheckPaymentsForBills([
      {
        billId: 'bill-1',
        amount: 50,
        payDate: '2025-01-15',
        bankGlAccountId: 'bank-1',
      },
    ]);

    expect(results[0].success).toBe(false);
    expect(results[0].error).toMatch(/missing a Buildium ID/i);
  });
});
