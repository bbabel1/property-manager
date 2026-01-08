import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import PaymentService from './payment-service';

type ManualEventType =
  | 'return.nsf'
  | 'chargeback.initiated'
  | 'chargeback.won'
  | 'chargeback.lost'
  | 'reversal.created';

type ManualEventInput = {
  orgId: string;
  paymentId: string;
  paymentIntentId?: string | null;
  rawEventType: ManualEventType;
  occurredAt?: string | null;
  eventData?: Record<string, unknown>;
  createdByUserId?: string | null;
};

async function insertManualEvent(input: ManualEventInput) {
  const { error } = await supabaseAdmin.from('manual_payment_events').insert({
    org_id: input.orgId,
    payment_id: input.paymentId,
    payment_intent_id: input.paymentIntentId ?? null,
    raw_event_type: input.rawEventType,
    normalized_event_type: input.rawEventType,
    event_data: input.eventData ?? {},
    occurred_at: input.occurredAt ?? new Date().toISOString(),
    created_by_user_id: input.createdByUserId ?? null,
  });

  if (error) {
    logger.error({ error, input }, 'Failed to insert manual payment event');
    throw error;
  }
}

async function fetchPayment(paymentId: string, orgId?: string) {
  const { data, error } = await supabaseAdmin
    .from('payment')
    .select('id, org_id, transaction_id, payment_intent_id')
    .eq('id', paymentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Payment not found');
  if (orgId && data.org_id !== orgId) {
    throw new Error('Payment org mismatch');
  }
  return data;
}

export class PaymentReversalService {
  static async createNSFReversal(params: {
    paymentId: string;
    orgId?: string | null;
    returnReasonCode?: string | null;
    returnedAt?: string | null;
    createdByUserId?: string | null;
  }) {
    const payment = await fetchPayment(params.paymentId, params.orgId ?? undefined);

    const updated = await PaymentService.recordReturn({
      paymentId: params.paymentId,
      orgId: payment.org_id,
      returnReasonCode: params.returnReasonCode ?? null,
      returnedAt: params.returnedAt ?? null,
    });

    await insertManualEvent({
      orgId: params.orgId,
      paymentId: params.paymentId,
      paymentIntentId: payment.payment_intent_id,
      rawEventType: 'return.nsf',
      occurredAt: params.returnedAt ?? null,
      eventData: { reason_code: params.returnReasonCode ?? null },
      createdByUserId: params.createdByUserId ?? null,
    });

    return updated;
  }

  static async createChargebackReversal(params: {
    paymentId: string;
    orgId?: string | null;
    chargebackId?: string | null;
    disputedAt?: string | null;
    createdByUserId?: string | null;
  }) {
    const payment = await fetchPayment(params.paymentId, params.orgId ?? undefined);

    const updated = await PaymentService.recordChargeback({
      paymentId: params.paymentId,
      orgId: payment.org_id,
      chargebackId: params.chargebackId ?? null,
      disputedAt: params.disputedAt ?? null,
    });

    await insertManualEvent({
      orgId: params.orgId,
      paymentId: params.paymentId,
      paymentIntentId: payment.payment_intent_id,
      rawEventType: 'chargeback.initiated',
      occurredAt: params.disputedAt ?? null,
      eventData: { chargeback_id: params.chargebackId ?? null },
      createdByUserId: params.createdByUserId ?? null,
    });

    return updated;
  }

  static async resolveChargeback(params: {
    paymentId: string;
    orgId?: string | null;
    won: boolean;
    occurredAt?: string | null;
    createdByUserId?: string | null;
  }) {
    const payment = await fetchPayment(params.paymentId, params.orgId ?? undefined);

    const updated = await PaymentService.resolveChargeback(payment.org_id, params.paymentId, params.won);

    await insertManualEvent({
      orgId: params.orgId,
      paymentId: params.paymentId,
      paymentIntentId: payment.payment_intent_id,
      rawEventType: params.won ? 'chargeback.won' : 'chargeback.lost',
      occurredAt: params.occurredAt ?? null,
      eventData: { won: params.won },
      createdByUserId: params.createdByUserId ?? null,
    });

    return updated;
  }
}

export default PaymentReversalService;
