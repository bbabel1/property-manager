import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  supabaseClient: { from: vi.fn() },
  user: {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
  },
}));

const adminState = vi.hoisted(() => {
  const state = {
    property: {
      id: 'prop-1',
      name: 'Test Property',
      org_id: 'org-123',
      buildium_property_id: null,
      rental_type: null,
    },
    transaction: {
      id: 'txn-1',
      transaction_type: 'GeneralJournalEntry',
    },
    journalEntry: {
      id: 'journal-1',
      transaction_id: 'txn-1',
      buildium_gl_entry_id: null as number | null,
    },
    accounts: [
      { id: 'acct-1', org_id: 'org-123', buildium_gl_account_id: null },
      { id: 'acct-2', org_id: 'org-123', buildium_gl_account_id: null },
    ],
    originalLines: [
      {
        id: 'line-1',
        transaction_id: 'txn-1',
        date: '2024-01-01',
        gl_account_id: 'acct-1',
        memo: 'Old debit',
        amount: 100,
        posting_type: 'Debit',
        account_entity_type: 'Rental',
        account_entity_id: null,
        property_id: 'prop-1',
        unit_id: null,
        buildium_property_id: null,
        buildium_unit_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'line-2',
        transaction_id: 'txn-1',
        date: '2024-01-01',
        gl_account_id: 'acct-2',
        memo: 'Old credit',
        amount: 100,
        posting_type: 'Credit',
        account_entity_type: 'Rental',
        account_entity_id: null,
        property_id: 'prop-1',
        unit_id: null,
        buildium_property_id: null,
        buildium_unit_id: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
  };

  const makeMaybeSingle = <T,>(result: T) =>
    vi.fn(async () => ({
      data: result,
      error: null,
    }));

  const makeSelectSingle = <T,>(result: T) =>
    vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: makeMaybeSingle(result),
      })),
    }));

  const makeSelectIn = <T,>(result: T) =>
    vi.fn(() => ({
      in: vi.fn(async () => ({
        data: result,
        error: null,
      })),
    }));

  const transactionLinesInsertMock = vi.fn(async () => ({ error: null }));
  const transactionLinesDeleteMock = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));
  const transactionLinesSelectMock = vi.fn(() => ({
    eq: vi.fn(async () => ({
      data: [...state.originalLines],
      error: null,
    })),
  }));

  const adminClient = {
    from: vi.fn((table: string) => {
      switch (table) {
        case 'properties':
          return {
            select: makeSelectSingle({ ...state.property }),
          };
        case 'journal_entries':
          return {
            select: makeSelectSingle({ ...state.journalEntry }),
          };
        case 'transactions':
          return {
            select: makeSelectSingle({ ...state.transaction }),
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        case 'gl_accounts':
          return {
            select: makeSelectIn([...state.accounts]),
          };
        case 'transaction_lines':
          return {
            select: transactionLinesSelectMock,
            delete: transactionLinesDeleteMock,
            insert: transactionLinesInsertMock,
          };
        case 'journal_entries_update':
        default:
          return {
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: null, error: null })),
            })),
          };
      }
    }),
  };

  const journalEntriesUpdateMock = vi.fn(() => ({
    eq: vi.fn(async () => ({ error: null })),
  }));

  // Override journal_entries update handling
  (adminClient.from as any).mockImplementation((table: string) => {
    if (table === 'journal_entries') {
      return {
        select: makeSelectSingle({ ...state.journalEntry }),
        update: journalEntriesUpdateMock,
      };
    }
    if (table === 'transaction_lines') {
      return {
        select: transactionLinesSelectMock,
        delete: transactionLinesDeleteMock,
        insert: transactionLinesInsertMock,
      };
    }
    if (table === 'gl_accounts') {
      return {
        select: makeSelectIn([...state.accounts]),
      };
    }
    if (table === 'transactions') {
      return {
        select: makeSelectSingle({ ...state.transaction }),
        update: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
        })),
      };
    }
    if (table === 'properties') {
      return {
        select: makeSelectSingle({ ...state.property }),
      };
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: null, error: null })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    };
  });

  return {
    state,
    adminClient,
    transactionLinesInsertMock,
    transactionLinesDeleteMock,
    transactionLinesSelectMock,
    journalEntriesUpdateMock,
  };
});

vi.mock('@/lib/auth/guards', () => ({
  requireAuth: vi.fn(async () => ({
    supabase: authState.supabaseClient,
    user: authState.user,
    roles: [],
  })),
}));

vi.mock('@/lib/supabase-client', () => ({
  requireSupabaseAdmin: vi.fn(() => adminState.adminClient),
  SupabaseAdminUnavailableError: class SupabaseAdminUnavailableError extends Error {},
}));

vi.mock('@/lib/auth/org-access', () => ({
  userHasOrgAccess: vi.fn(async () => true),
  resolveUserOrgId: vi.fn(async () => 'org-123'),
}));

import { PUT } from '@/app/api/journal-entries/[transactionId]/route';

describe('PUT /api/journal-entries/[transactionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminState.state.journalEntry.buildium_gl_entry_id = null;
  });

  it('updates journal entry successfully', async () => {
    const payload = {
      date: '2024-02-01',
      propertyId: 'prop-1',
      unitId: null,
      memo: 'Updated entry',
      lines: [
        { accountId: 'acct-1', description: 'Debit line', debit: 150, credit: 0 },
        { accountId: 'acct-2', description: 'Credit line', debit: 0, credit: 150 },
      ],
    };

    const request = new Request('http://localhost/api/journal-entries/txn-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = (await PUT(request, { params: Promise.resolve({ transactionId: 'txn-1' }) })) as Response;
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(adminState.transactionLinesInsertMock).toHaveBeenCalled();
  });

  it('returns 409 when entry is synced to Buildium', async () => {
    adminState.state.journalEntry.buildium_gl_entry_id = 999;

    const payload = {
      date: '2024-02-01',
      propertyId: 'prop-1',
      unitId: null,
      memo: 'Updated entry',
      lines: [
        { accountId: 'acct-1', description: 'Debit line', debit: 150, credit: 0 },
        { accountId: 'acct-2', description: 'Credit line', debit: 0, credit: 150 },
      ],
    };

    const request = new Request('http://localhost/api/journal-entries/txn-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const response = (await PUT(request, { params: Promise.resolve({ transactionId: 'txn-1' }) })) as Response;
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/cannot be edited/i);
  });
});

