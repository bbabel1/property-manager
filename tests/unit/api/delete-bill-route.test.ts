import { beforeEach, describe, expect, it, vi } from 'vitest';

const supabaseState = vi.hoisted(() => {
  const transactionRow = {
    id: 'bill-1',
    transaction_type: 'Bill',
    buildium_bill_id: 555,
  };

  const transactionSelectMock = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({ data: { ...transactionRow }, error: null })),
    })),
  }));

  const transactionDeleteMock = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));

  const transactionLinesDeleteMock = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));

  const supabaseAdmin = {
    from: vi.fn((table: string) => {
      if (table === 'transactions') {
        return {
          select: transactionSelectMock,
          delete: transactionDeleteMock,
        };
      }
      if (table === 'transaction_lines') {
        return {
          delete: transactionLinesDeleteMock,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return {
    supabaseAdmin,
    transactionRow,
    transactionSelectMock,
    transactionDeleteMock,
    transactionLinesDeleteMock,
  };
});

vi.mock('@/lib/supabase-client', () => ({
  requireSupabaseAdmin: vi.fn(() => supabaseState.supabaseAdmin),
}));

const { mapTransactionBillToBuildiumMock } = vi.hoisted(() => ({
  mapTransactionBillToBuildiumMock: vi.fn(),
}));
vi.mock('@/lib/buildium-mappers', () => ({
  mapTransactionBillToBuildium: mapTransactionBillToBuildiumMock,
}));

import { DELETE } from '@/app/api/bills/[id]/route';

const fetchMock = vi.fn();
const originalFetch = global.fetch;

describe('DELETE /api/bills/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseState.transactionRow.id = 'bill-1';
    supabaseState.transactionRow.transaction_type = 'Bill';
    supabaseState.transactionRow.buildium_bill_id = 555;
    mapTransactionBillToBuildiumMock.mockResolvedValue({
      Amount: 1200,
      Lines: [
        { Amount: 800, AccountingEntity: { Id: 1 }, GlAccountId: 1 },
        { Amount: 400, AccountingEntity: { Id: 2 }, GlAccountId: 2 },
        { Amount: -1200, AccountingEntity: { Id: 3 }, GlAccountId: 3 },
      ],
    });
    global.fetch = fetchMock as any;
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn(async () => JSON.stringify({ Message: 'Zeroed' })),
    });
    process.env.BUILDIUM_BASE_URL = 'https://buildium.example.com';
    process.env.BUILDIUM_CLIENT_ID = 'client';
    process.env.BUILDIUM_CLIENT_SECRET = 'secret';
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('returns Buildium confirmation response before deleting locally', async () => {
    const request = new Request('http://localhost/api/bills/bill-1', { method: 'DELETE' });
    const response = (await DELETE(request, { params: Promise.resolve({ id: 'bill-1' }) })) as Response;
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.confirmationRequired).toBe(true);
    expect(body.buildium).toEqual({
      success: true,
      status: 200,
      payload: { Message: 'Zeroed' },
    });
    expect(body.confirmation?.token).toBeTruthy();
    expect(supabaseState.transactionLinesDeleteMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://buildium.example.com/bills/555',
      expect.objectContaining({
        method: 'PUT',
      }),
    );
    const [, fetchOptions] = fetchMock.mock.calls[0];
    const buildiumPayload = JSON.parse(fetchOptions.body as string);
    expect(buildiumPayload.Amount).toBe(0);
    expect(buildiumPayload.Lines).toHaveLength(3);
    expect(buildiumPayload.Lines.slice(0, 2)).toEqual([
      expect.objectContaining({ Amount: 0.02 }),
      expect.objectContaining({ Amount: 0.02 }),
    ]);
    expect(buildiumPayload.Lines[2]).toEqual(expect.objectContaining({ Amount: -0.04 }));
  });

  it('deletes bill locally after confirmation token is provided', async () => {
    const firstResponse = (await DELETE(
      new Request('http://localhost/api/bills/bill-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'bill-1' }) },
    )) as Response;
    const firstBody = await firstResponse.json();
    const confirmPayload = {
      buildiumConfirmation: {
        token: firstBody.confirmation.token,
        issuedAt: firstBody.confirmation.issuedAt,
      },
    };
    const confirmResponse = (await DELETE(
      new Request('http://localhost/api/bills/bill-1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmPayload),
      }),
      { params: Promise.resolve({ id: 'bill-1' }) },
    )) as Response;
    expect(confirmResponse.status).toBe(200);
    const finalBody = await confirmResponse.json();
    expect(finalBody.success).toBe(true);
    expect(supabaseState.transactionLinesDeleteMock).toHaveBeenCalled();
    expect(supabaseState.transactionDeleteMock).toHaveBeenCalled();
  });

  it('rejects invalid confirmation tokens', async () => {
    supabaseState.transactionLinesDeleteMock.mockClear();
    const response = (await DELETE(
      new Request('http://localhost/api/bills/bill-1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buildiumConfirmation: { token: 'bad', issuedAt: new Date().toISOString() },
        }),
      }),
      { params: Promise.resolve({ id: 'bill-1' }) },
    )) as Response;
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/confirmation/i);
    expect(supabaseState.transactionLinesDeleteMock).not.toHaveBeenCalled();
  });

  it('immediately deletes bills without Buildium ids', async () => {
    supabaseState.transactionRow.buildium_bill_id = null as any;
    const response = (await DELETE(new Request('http://localhost/api/bills/bill-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'bill-1' }),
    })) as Response;
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(supabaseState.transactionLinesDeleteMock).toHaveBeenCalled();
  });

  it('bubbles Buildium API failures', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: vi.fn(async () => JSON.stringify({ Message: 'Line items already paid' })),
    });
    const response = (await DELETE(new Request('http://localhost/api/bills/bill-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'bill-1' }),
    })) as Response;
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error).toBe('Line items already paid');
    expect(body.buildium).toEqual({
      success: false,
      status: 422,
      payload: { Message: 'Line items already paid' },
    });
    expect(supabaseState.transactionLinesDeleteMock).not.toHaveBeenCalled();
  });
});
