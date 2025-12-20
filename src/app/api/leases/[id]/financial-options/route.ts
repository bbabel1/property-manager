import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const leaseId = Number(id);

    if (!Number.isFinite(leaseId)) {
      return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 });
    }

    const supabase =
      process.env.NODE_ENV === 'development' ? supabaseAdmin : (await requireAuth()).supabase;

    const { data: leaseRow, error: leaseError } = await supabase
      .from('lease')
      .select('org_id')
      .eq('id', leaseId)
      .maybeSingle();

    if (leaseError) {
      throw leaseError;
    }

    const orgId = leaseRow?.org_id;
    if (!orgId) {
      return NextResponse.json({ accountOptions: [], bankAccountOptions: [] });
    }

    const [glAccountsResult, bankAccountsResult] = await Promise.all([
      supabase
        .from('gl_accounts')
        .select('id, name, type, buildium_gl_account_id')
        .eq('org_id', orgId)
        .order('name', { ascending: true }),
      supabase
        .from('gl_accounts')
        .select('id, name')
        .eq('org_id', orgId)
        .eq('is_bank_account', true)
        .order('name', { ascending: true }),
    ]);

    if (glAccountsResult.error) throw glAccountsResult.error;
    if (bankAccountsResult.error) throw bankAccountsResult.error;

    const allAccountOptions =
      glAccountsResult.data
        ?.filter((row) => row?.id != null)
        .map((row) => ({
          id: String(row.id),
          name: row.name || 'Account',
          type: row.type || null,
          buildiumGlAccountId:
            typeof row.buildium_gl_account_id === 'number'
              ? row.buildium_gl_account_id
              : row.buildium_gl_account_id != null && !Number.isNaN(Number(row.buildium_gl_account_id))
                ? Number(row.buildium_gl_account_id)
                : null,
        })) ?? [];

    const accountOptions = allAccountOptions.filter(
      (option) => option.buildiumGlAccountId != null,
    );
    const unmappedAccountCount = allAccountOptions.length - accountOptions.length;

    const bankAccountOptions =
      bankAccountsResult.data
        ?.filter((row) => row?.id != null)
        .map((row) => ({ id: String(row.id), name: row.name || 'Bank account' })) ?? [];

    return NextResponse.json({ accountOptions, bankAccountOptions, unmappedAccountCount });
  } catch (error) {
    console.error('Error in GET /api/leases/[id]/financial-options:', error);
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
