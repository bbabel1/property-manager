import { beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  property: {
    id: 'prop-1',
    org_id: 'org-123',
  },
  journalEntry: {
    id: 'journal-1',
    transaction_id: 'txn-1',
    buildium_gl_entry_id: null as number | null,
  },
  transactionLines: [{ property_id: 'prop-1' }],
  transactionRow: {
    id: 'txn-1',
    transaction_type: 'GeneralJournalEntry',
  },
  orgMemberships: [{ org_id: 'org-123' }],
}));

const supabaseStub = vi.hoisted(() => ({
  from: vi.fn(),
}));

const requireAuthMock = vi.hoisted(() =>
  vi.fn(async () => ({
    supabase: supabaseStub,
    user: {
      id: 'user-1',
      app_metadata: {},
      user_metadata: {},
    },
    roles: [],
  })),
);

const adminState = vi.hoisted(() => {
  const propertySelectMock = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: testState.property ? { ...testState.property } : null,
        error: null,
      })),
    })),
  }));

  const journalSelectMock = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: testState.journalEntry ? { ...testState.journalEntry } : null,
        error: null,
      })),
    })),
  }));

  const linesSelectMock = vi.fn(() => ({
    eq: vi.fn(async () => ({
      data: testState.transactionLines?.map((line) => ({ ...line })) ?? [],
      error: null,
    })),
  }));

  const transactionSelectMock = vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: testState.transactionRow ? { ...testState.transactionRow } : null,
        error: null,
      })),
    })),
  }));

  const journalDeleteMock = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));
  const transactionLinesDeleteMock = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));
  const transactionDeleteMock = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));

  const adminClient = {
    from: vi.fn((table: string) => {
      switch (table) {
        case 'properties':
          return {
            select: propertySelectMock,
          };
        case 'journal_entries':
          return {
            select: journalSelectMock,
            delete: journalDeleteMock,
          };
        case 'transaction_lines':
          return {
            select: linesSelectMock,
            delete: transactionLinesDeleteMock,
          };
        case 'transactions':
          return {
            select: transactionSelectMock,
            delete: transactionDeleteMock,
          };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    }),
  };

  return {
    adminClient,
    journalDeleteMock,
    transactionLinesDeleteMock,
    transactionDeleteMock,
  };
});

const requireSupabaseAdminMock = vi.hoisted(() => vi.fn(() => adminState.adminClient));

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: requireAuthMock,
}));

vi.mock('@/lib/supabase-client', () => ({
  requireSupabaseAdmin: requireSupabaseAdminMock,
  SupabaseAdminUnavailableError: class SupabaseAdminUnavailableError extends Error {},
}));

import { DELETE } from '@/app/api/journal-entries/[transactionId]/route';

describe('DELETE /api/journal-entries/[transactionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.property = { id: 'prop-1', org_id: 'org-123' };
    testState.journalEntry = {
      id: 'journal-1',
      transaction_id: 'txn-1',
      buildium_gl_entry_id: null,
    };
    testState.transactionLines = [{ property_id: 'prop-1' }];
    testState.transactionRow = { id: 'txn-1', transaction_type: 'GeneralJournalEntry' };
    testState.orgMemberships = [{ org_id: 'org-123' }];

    adminState.adminClient.from.mockClear();
    adminState.journalDeleteMock.mockClear();
    adminState.transactionLinesDeleteMock.mockClear();
    adminState.transactionDeleteMock.mockClear();

    supabaseStub.from.mockImplementation((table: string) => {
      if (table !== 'org_memberships') {
        throw new Error(`Unexpected supabase table ${table}`);
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async (_column: string, userId: string) => {
            if (userId !== 'user-1') {
              return { data: [], error: null };
            }
            return { data: [...testState.orgMemberships], error: null };
          }),
        })),
      };
    });
  });

  it('deletes journal entries when membership grants access', async () => {
    const response = (await DELETE(
      new Request('http://localhost/api/journal-entries/txn-1?propertyId=prop-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ transactionId: 'txn-1' }) },
    )) as Response;

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(requireSupabaseAdminMock).toHaveBeenCalled();
    expect(adminState.adminClient.from).toHaveBeenCalledWith('transaction_lines');
    expect(adminState.journalDeleteMock).toHaveBeenCalled();
  });

  it('returns 403 when user lacks property org access', async () => {
    testState.orgMemberships = [{ org_id: 'org-456' }];

    const response = (await DELETE(
      new Request('http://localhost/api/journal-entries/txn-1?propertyId=prop-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ transactionId: 'txn-1' }) },
    )) as Response;

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe('You do not have access to this property');
  });

  it('allows deletion when org id comes from metadata', async () => {
    const userWithMetadata = {
      id: 'user-1',
      app_metadata: {
        claims: { org_ids: ['org-123'] },
      },
      user_metadata: {},
    };
    requireAuthMock.mockResolvedValueOnce({
      supabase: supabaseStub,
      user: userWithMetadata,
      roles: [],
    });
    testState.orgMemberships = [];

    const response = (await DELETE(
      new Request('http://localhost/api/journal-entries/txn-1?propertyId=prop-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ transactionId: 'txn-1' }) },
    )) as Response;

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it('deletes even when journal entry row is missing', async () => {
    testState.journalEntry = null as unknown as typeof testState.journalEntry;

    const response = (await DELETE(
      new Request('http://localhost/api/journal-entries/txn-1?propertyId=prop-1', {
        method: 'DELETE',
      }),
      { params: Promise.resolve({ transactionId: 'txn-1' }) },
    )) as Response;

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(adminState.journalDeleteMock).not.toHaveBeenCalled();
    expect(adminState.transactionDeleteMock).toHaveBeenCalled();
  });
});

