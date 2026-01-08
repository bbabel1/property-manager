import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasSupabaseAdmin } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/db';

export async function GET(
  _request: Request,
  context: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await context.params;
  if (!intentId) {
    return NextResponse.json({ error: 'Missing intentId' }, { status: 400 });
  }

  try {
    if (!hasSupabaseAdmin()) {
      await requireAuth();
    }

    const { data: intentRow, error: intentError } = await supabaseAdmin
      .from('payment_intent')
      .select('id, org_id')
      .eq('id', intentId)
      .maybeSingle();

    if (intentError) {
      return NextResponse.json({ error: intentError.message }, { status: 500 });
    }

    if (!intentRow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const orgId = intentRow.org_id;

    const { data, error } = await supabaseAdmin
      .from('payment_events')
      .select('*')
      .eq('org_id', orgId)
      .eq('payment_intent_id', intentId)
      .order('occurred_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (error) {
    console.error('Error fetching payment intent events', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
