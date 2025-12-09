import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireOrg } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (!hasPermission(auth.roles, 'financials.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const { supabase } = auth;

    const { data: event, error: fetchError } = await supabase
      .from('billing_events')
      .select('invoiced_at, transaction_id, property_id, properties!inner(org_id)')
      .eq('id', id)
      .single();

    if (fetchError || !event) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Billing event not found' } },
        { status: 404 },
      );
    }

    if (event.invoiced_at) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Cannot void invoiced billing event' } },
        { status: 400 },
      );
    }

    const { supabase: supabaseOrg } = await requireOrg(String(event.properties?.org_id));

    // Delete the billing event (or mark as voided if we add a status field)
    const { error: deleteError } = await supabaseOrg.from('billing_events').delete().eq('id', id);

    if (deleteError) {
      logger.error({ error: deleteError }, 'Error voiding billing event');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to void billing event' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error in POST /api/services/billing-events/[id]/void');
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
