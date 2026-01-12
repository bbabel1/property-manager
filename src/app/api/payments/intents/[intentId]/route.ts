import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import PaymentIntentService from '@/lib/payments/payment-intent-service';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await context.params;
  if (!intentId) {
    return NextResponse.json({ error: 'Missing intentId' }, { status: 400 });
  }

  try {
    const { supabase, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);

    const { data: intentRow, error } = await supabase
      .from('payment_intent')
      .select('*')
      .eq('id', intentId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to load intent' }, { status: 500 });
    }
    if (!intentRow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const payment = await PaymentIntentService.findPaymentByIntentId(intentRow.org_id, intentId);

    return NextResponse.json({
      data: {
        intent: intentRow,
        payment,
      },
    });
  } catch (error) {
    console.error('Error fetching payment intent', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
