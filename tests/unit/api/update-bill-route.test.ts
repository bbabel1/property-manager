import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockSupabaseAdmin,
  resetSupabaseMocks,
  setBillSnapshot,
} = vi.hoisted(() => {
  const baseBill = {
    id: 'bill-1',
    date: '2024-05-01',
    due_date: null,
    vendor_id: 'vendor-1',
    reference_number: 'REF-1',
    memo: 'Test bill',
    buildium_bill_id: 555,
  };

  let transactionHeader = { ...baseBill };
  let billSnapshot = { ...baseBill };

  const createTransactionsTable = () => ({
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: { ...transactionHeader }, error: null })),
        })),
      })),
    })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: { ...billSnapshot }, error: null })),
      })),
    })),
  });

  const createTransactionLinesTable = () => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    })),
    insert: vi.fn(async () => ({ error: null })),
  });

  let transactionsTable = createTransactionsTable();
  let transactionLinesTable = createTransactionLinesTable();

  const supabaseAdmin = {
    from: vi.fn((table: string) => {
      if (table === 'transactions') return transactionsTable;
      if (table === 'transaction_lines') return transactionLinesTable;
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    mockSupabaseAdmin: supabaseAdmin,
    resetSupabaseMocks: () => {
      transactionHeader = { ...baseBill };
      billSnapshot = { ...baseBill };
      transactionsTable = createTransactionsTable();
      transactionLinesTable = createTransactionLinesTable();
    },
    setBillSnapshot: (partial: Partial<typeof baseBill>) => {
      billSnapshot = { ...billSnapshot, ...partial };
      transactionHeader = { ...transactionHeader, ...partial };
    },
  };
});

vi.mock('@/lib/supabase-client', () => ({
  requireSupabaseAdmin: vi.fn(() => mockSupabaseAdmin),
}));

vi.mock('@/lib/buildium-mappers', () => ({
  mapTransactionBillToBuildium: vi.fn(),
}));

import { PATCH } from '@/app/api/bills/[id]/route';
import { mapTransactionBillToBuildium } from '@/lib/buildium-mappers';

const fetchMock = vi.fn();
const originalFetch = global.fetch;
const buildiumMapperMock = vi.mocked(mapTransactionBillToBuildium);

beforeEach(() => {
  fetchMock.mockReset();
  vi.clearAllMocks();
  resetSupabaseMocks();
  setBillSnapshot({ buildium_bill_id: 555 });
  global.fetch = fetchMock as any;
  process.env.BUILDIUM_BASE_URL = 'https://buildium.example.com';
  process.env.BUILDIUM_CLIENT_ID = 'client-id';
  process.env.BUILDIUM_CLIENT_SECRET = 'client-secret';
});

afterAll(() => {
  global.fetch = originalFetch;
});

const requestPayload = {
  date: '2024-05-01',
  due_date: '2024-05-05',
  vendor_id: 'vendor-1',
  reference_number: 'REF-1',
  memo: 'Updated memo',
  lines: [],
};

describe('PATCH /api/bills/[id]', () => {
  it('returns Buildium payload on success', async () => {
    buildiumMapperMock.mockResolvedValue({ some: 'payload' } as any);
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn(async () => JSON.stringify({ Id: 777, Message: 'Updated' })),
    });

    const request = new Request('http://localhost/api/bills/bill-1', {
      method: 'PATCH',
      body: JSON.stringify(requestPayload),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = (await PATCH(request, { params: Promise.resolve({ id: 'bill-1' }) })) as Response;
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://buildium.example.com/bills/555',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ some: 'payload' }),
      }),
    );
    const body = await response.json();
    expect(body.buildium).toEqual({
      success: true,
      status: 200,
      payload: { Id: 777, Message: 'Updated' },
    });
    expect(body.data.buildium_bill_id).toBe(555);
  });

  it('propagates Buildium errors with upstream payload', async () => {
    buildiumMapperMock.mockResolvedValue({ some: 'payload' } as any);
    fetchMock.mockResolvedValue({
      ok: false,
      status: 422,
      text: vi.fn(async () => JSON.stringify({ Message: 'Invalid line item' })),
    });

    const request = new Request('http://localhost/api/bills/bill-1', {
      method: 'PATCH',
      body: JSON.stringify(requestPayload),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = (await PATCH(request, { params: Promise.resolve({ id: 'bill-1' }) })) as Response;
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe('Invalid line item');
    expect(body.buildium).toEqual({
      success: false,
      status: 422,
      payload: { Message: 'Invalid line item' },
    });
  });
});
