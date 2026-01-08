import { describe, expect, it, vi, beforeEach } from 'vitest';
import { syncBuildiumReconciliationTransactions } from '../buildium-reconciliation-sync';
import { buildiumFetch } from '@/lib/buildium-http';

vi.mock('@/lib/buildium-http', () => ({
  buildiumFetch: vi.fn(),
}));

const mockedBuildiumFetch = vi.mocked(buildiumFetch);

const makeSupabaseStub = () => {
  const upserts: any[] = [];
  const updates: any[] = [];
  return {
    upserts,
    updates,
    from(table: string) {
      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: 'tx1', org_id: 'org1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'bank_register_state') {
        return {
          upsert: async (payload: any) => {
            upserts.push(payload);
            return { error: null };
          },
          select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        };
      }
      if (table === 'reconciliation_log') {
        return {
          update: async (payload: any) => {
            updates.push(payload);
            return { eq: () => ({}) };
          },
        };
      }
      return {};
    },
    rpc: async () => ({ data: null, error: null }),
  };
};

describe('syncBuildiumReconciliationTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Buildium bank account id in the fetch path and upserts state', async () => {
    mockedBuildiumFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: [{ Id: 101, Status: 'Cleared' }],
    });
    const supabase = makeSupabaseStub();

    const result = await syncBuildiumReconciliationTransactions(
      'rec-1',
      555,
      'local-bank-gl',
      9999,
      supabase as any,
    );

    expect(mockedBuildiumFetch).toHaveBeenCalledWith(
      'GET',
      '/bankaccounts/9999/reconciliations/555/transactions',
      undefined,
      undefined,
      undefined,
    );
    expect(result.synced).toBe(1);
    expect(supabase.upserts.length).toBe(1);
    expect(supabase.upserts[0]).toMatchObject({
      bank_gl_account_id: 'local-bank-gl',
      buildium_transaction_id: 101,
      current_reconciliation_log_id: 'rec-1',
    });
  });
});
