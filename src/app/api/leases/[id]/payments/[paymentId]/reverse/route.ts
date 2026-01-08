import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import { reversePaymentWithNSF } from '@/lib/accounting/reversals';

const ReversePaymentSchema = z.object({
  reversal_date: z.string().optional(),
  memo: z.string().nullable().optional(),
  create_nsf_fee: z.boolean().optional(),
  nsf_fee_amount: z.number().positive().nullable().optional(),
  nsf_fee_gl_account_id: z.string().nullable().optional(),
  external_id: z.string().nullable().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; paymentId: string }> },
) {
  const { id, paymentId } = await context.params;
  const leaseId = Number(id);
  if (Number.isNaN(leaseId)) {
    return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 });
  }

  try {
    await requireAuth();
    const body = await request.json().catch(() => ({}));
    const parsed = ReversePaymentSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 });
    }

    const { data: paymentRow, error } = await supabaseAdmin
      .from('transactions')
      .select('org_id, lease_id')
      .eq('id', paymentId)
      .maybeSingle();
    if (error) throw error;
    if (!paymentRow?.org_id) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    if (paymentRow.lease_id && Number(paymentRow.lease_id) !== leaseId) {
      return NextResponse.json({ error: 'Payment lease mismatch' }, { status: 422 });
    }

    const reversalDate =
      typeof parsed.data.reversal_date === 'string' && parsed.data.reversal_date
        ? parsed.data.reversal_date
        : new Date().toISOString().slice(0, 10);

    const result = await reversePaymentWithNSF({
      paymentTransactionId: paymentId,
      orgId: paymentRow.org_id,
      reversalDate,
      memo: parsed.data.memo ?? null,
      nsfFeeAmount: parsed.data.nsf_fee_amount ?? null,
      nsfFeeGlAccountId: parsed.data.nsf_fee_gl_account_id ?? null,
      createNsfFee: parsed.data.create_nsf_fee ?? null,
      externalId: parsed.data.external_id ?? null,
    });

    return NextResponse.json(
      {
        data: {
          reversal_transaction_id: result.reversalTransactionId,
          nsf_charge_id: result.nsfChargeId,
          updated_charges: result.updatedCharges,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    if (message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (
      message.includes('Payment') ||
      message.includes('allocation') ||
      message.includes('org mismatch') ||
      message.includes('lease mismatch')
    ) {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
