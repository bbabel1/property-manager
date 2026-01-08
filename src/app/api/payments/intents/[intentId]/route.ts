import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasSupabaseAdmin } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/db';
import PaymentService from '@/lib/payments/payment-service';

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

    const { data: intentRow } = await supabaseAdmin
      .from('payment_intent')
      .select('*')
      .eq('id', intentId)
      .maybeSingle();

    if (!intentRow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const payment = await PaymentService.findPaymentByIntentId(intentRow.org_id, intentId);

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
