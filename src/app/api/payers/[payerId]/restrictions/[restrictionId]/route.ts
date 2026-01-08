import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import PayerRestrictionsService from '@/lib/payments/payer-restrictions-service';
import { hasPermission } from '@/lib/permissions';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ payerId: string; restrictionId: string }> },
) {
  const { payerId, restrictionId } = await context.params;
  if (!payerId || !restrictionId) {
    return NextResponse.json({ error: 'Missing payerId or restrictionId' }, { status: 400 });
  }

  try {
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'settings.write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch restriction and ensure it belongs to the requested payer
    const { data: restriction, error: fetchError } = await supabaseAdmin
      .from('payer_restrictions')
      .select('id, org_id, payer_id')
      .eq('id', restrictionId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!restriction || restriction.payer_id !== payerId) {
      return NextResponse.json({ error: 'Restriction not found' }, { status: 404 });
    }

    // Ensure the current user is a member of the restriction's org
    const { data: membership } = await supabaseAdmin
      .from('org_memberships')
      .select('id')
      .eq('org_id', restriction.org_id)
      .eq('user_id', auth.user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await PayerRestrictionsService.clearRestriction(restriction.org_id, restrictionId);
    return NextResponse.json({ data: { cleared: true } });
  } catch (error) {
    console.error('Error clearing payer restriction', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
