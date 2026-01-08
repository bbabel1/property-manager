import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import PaymentReversalService from '@/lib/payments/reversal-service';
import { supabaseAdmin } from '@/lib/db';

const ReturnSchema = z.object({
  reason_code: z.string().nullable().optional(),
  occurred_at: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = ReturnSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const auth = await requireAuth();

    // Ensure user is a member of the payment's org
    const { data: payment } = await supabaseAdmin
      .from('payment')
      .select('org_id')
      .eq('id', paymentId)
      .maybeSingle();
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    const { data: membership } = await supabaseAdmin
      .from('org_memberships')
      .select('id')
      .eq('org_id', payment.org_id)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updated = await PaymentReversalService.createNSFReversal({
      paymentId,
      orgId: payment.org_id,
      returnReasonCode: parsed.data.reason_code ?? null,
      returnedAt: parsed.data.occurred_at ?? null,
      createdByUserId: auth.user.id,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Error recording payment return', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
