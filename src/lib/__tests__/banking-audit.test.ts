import { describe, expect, it, vi } from 'vitest';
import { logBankingAuditEvent } from '../banking-audit';

describe('logBankingAuditEvent', () => {
  it('logs and swallows insert errors', async () => {
    const insertError = new Error('insert failed');
    const supabase = {
      from: () => ({
        insert: async () => ({ error: insertError }),
      }),
    } as any;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await logBankingAuditEvent(supabase, {
      orgId: 'org1',
      actorUserId: null,
      action: 'system_sync',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to log banking audit event:',
      insertError,
    );
    consoleSpy.mockRestore();
  });
});
