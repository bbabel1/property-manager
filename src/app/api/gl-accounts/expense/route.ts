import { NextRequest, NextResponse } from 'next/server';

import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    const { data, error } = await supabase
      .from('gl_accounts')
      .select('id, name, account_number, type, is_active')
      .eq('type', 'Expense')
      .eq('org_id', orgId)
      .is('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Failed to load expense accounts', error);
      return NextResponse.json(
        { success: false, error: 'Failed to load expense accounts.' },
        { status: 500 },
      );
    }

    const accounts = Array.isArray(data)
      ? data.map((row) => ({
          id: row.id as string,
          name: row.name as string,
          accountNumber: (row.account_number as string | null) ?? null,
        }))
      : [];

    return NextResponse.json({ success: true, data: accounts });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ success: false, error: 'Organization context required.' }, { status: 400 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
      }
    }
    console.error('Unexpected error loading expense accounts', error);
    return NextResponse.json(
      { success: false, error: 'Unexpected error loading expense accounts.' },
      { status: 500 },
    );
  }
}
