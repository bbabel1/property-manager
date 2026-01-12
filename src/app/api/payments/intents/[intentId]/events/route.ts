import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await context.params;
  if (!intentId) {
    return NextResponse.json({ error: 'Missing intentId' }, { status: 400 });
  }

  try {
    const { supabase: db, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });
    const supabase = supabaseAdmin ?? db;

    const { data: intentRow, error: intentError } = await supabase
      .from('payment_intent')
      .select('id, org_id')
      .eq('id', intentId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (intentError) {
      return NextResponse.json({ error: intentError.message }, { status: 500 });
    }

    if (!intentRow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const intentOrgId = intentRow.org_id;

    const { data, error } = await supabase
      .from('payment_events')
      .select('*')
      .eq('org_id', intentOrgId)
      .eq('payment_intent_id', intentId)
      .order('occurred_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error('Error fetching payment intent events', error);
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
