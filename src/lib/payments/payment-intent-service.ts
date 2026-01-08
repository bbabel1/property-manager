import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  PaymentIntentRow,
  PaymentIntentState,
  PaymentRow,
  TransactionRow,
} from '@/types/payments';

const PAYMENT_INTENT_COLUMNS =
  'id, org_id, idempotency_key, amount, payment_method, state, gateway_provider, gateway_intent_id, allocation_plan, bypass_udf, metadata, payer_id, payer_type, submitted_at, created_at, updated_at';

type CreateIntentParams = {
  orgId: string;
  amount: number;
  paymentMethod?: PaymentIntentRow['payment_method'] | null;
  payerId?: string | null;
  payerType?: string | null;
  allocationPlan?: PaymentIntentRow['allocation_plan'];
  bypassUdf?: boolean;
  metadata?: PaymentIntentRow['metadata'];
  gatewayProvider?: string | null;
};

type SubmitIntentParams = {
  intentId: string;
  orgId: string;
  gatewayTransactionId?: string | number | null;
  state?: PaymentIntentState;
};

const failureCodeCache = new Map<string, boolean>();

async function normalizeFailureCode(rawCode: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('buildium_failure_codes')
    .select('normalized_code')
    .eq('raw_code', rawCode)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data?.normalized_code ?? null;
}

async function isFailureCode(code: string | null): Promise<boolean> {
  if (!code) return false;
  if (failureCodeCache.has(code)) {
    return Boolean(failureCodeCache.get(code));
  }
  const normalized = await normalizeFailureCode(code);
  const isFailure = normalized !== null;
  failureCodeCache.set(code, isFailure);
  return isFailure;
}

function deriveSettledAt(transaction: TransactionRow): Date | null {
  if (transaction.internal_transaction_result_date) {
    return new Date(transaction.internal_transaction_result_date);
  }
  if (!transaction.is_internal_transaction || transaction.is_internal_transaction === null) {
    return transaction.created_at ? new Date(transaction.created_at) : null;
  }
  return null;
}

async function derivePaymentState(transaction: TransactionRow): Promise<PaymentIntentState> {
  const failureCode = transaction.internal_transaction_result_code;
  if (await isFailureCode(failureCode)) {
    return 'failed';
  }

  if (transaction.is_internal_transaction && transaction.internal_transaction_is_pending) {
    return 'pending';
  }

  if (transaction.is_internal_transaction && !transaction.internal_transaction_is_pending) {
    return 'settled';
  }

  if (!transaction.is_internal_transaction || transaction.is_internal_transaction === null) {
    return 'settled';
  }

  return 'submitted';
}

export class PaymentIntentService {
  static async findByIdempotencyKey(
    orgId: string,
    idempotencyKey: string,
  ): Promise<PaymentIntentRow | null> {
    const { data, error } = await supabaseAdmin
      .from('payment_intent')
      .select(PAYMENT_INTENT_COLUMNS)
      .eq('org_id', orgId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return (data as PaymentIntentRow | null) ?? null;
  }

  static async findByIntentId(orgId: string, intentId: string): Promise<PaymentIntentRow | null> {
    const { data, error } = await supabaseAdmin
      .from('payment_intent')
      .select(PAYMENT_INTENT_COLUMNS)
      .eq('org_id', orgId)
      .eq('id', intentId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return (data as PaymentIntentRow | null) ?? null;
  }

  static async createIntent(
    params: CreateIntentParams,
    idempotencyKey?: string,
  ): Promise<{ intent: PaymentIntentRow; idempotencyKey: string; reused: boolean }> {
    const key = idempotencyKey?.trim() || randomUUID();
    const existing = await this.findByIdempotencyKey(params.orgId, key);
    if (existing) {
      return { intent: existing, idempotencyKey: key, reused: true };
    }

    const insertPayload = {
      org_id: params.orgId,
      idempotency_key: key,
      amount: params.amount,
      payment_method: params.paymentMethod ?? null,
      payer_id: params.payerId ?? null,
      payer_type: params.payerType ?? null,
      allocation_plan: params.allocationPlan ?? null,
      bypass_udf: params.bypassUdf ?? false,
      metadata: params.metadata ?? {},
      gateway_provider: params.gatewayProvider ?? 'buildium',
      state: 'created' as PaymentIntentState,
    };

    const { data, error } = await supabaseAdmin
      .from('payment_intent')
      .insert(insertPayload)
      .select(PAYMENT_INTENT_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        const intent = await this.findByIdempotencyKey(params.orgId, key);
        if (intent) {
          return { intent, idempotencyKey: key, reused: true };
        }
      }
      throw error;
    }

    return { intent: data as PaymentIntentRow, idempotencyKey: key, reused: false };
  }

  static async submitIntent(params: SubmitIntentParams): Promise<PaymentIntentRow | null> {
    const nowIso = new Date().toISOString();
    const gatewayIntentId =
      params.gatewayTransactionId !== undefined && params.gatewayTransactionId !== null
        ? String(params.gatewayTransactionId)
        : null;

    const { data, error } = await supabaseAdmin
      .from('payment_intent')
      .update({
        state: params.state ?? ('submitted' as PaymentIntentState),
        gateway_intent_id: gatewayIntentId,
        submitted_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', params.intentId)
      .eq('org_id', params.orgId)
      .select(PAYMENT_INTENT_COLUMNS)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return (data as PaymentIntentRow | null) ?? null;
  }

  static async transitionStateFromBuildiumFields(params: {
    orgId: string;
    intentId: string;
    transaction: TransactionRow;
  }): Promise<PaymentIntentRow | null> {
    const nowIso = new Date().toISOString();
    const state = await derivePaymentState(params.transaction);
    const settledAt = deriveSettledAt(params.transaction);
    const updates: Partial<PaymentIntentRow> & { updated_at: string } = {
      state,
      updated_at: nowIso,
    };

    if (settledAt) {
      updates.submitted_at = settledAt.toISOString();
    }

    if (params.transaction.buildium_transaction_id != null) {
      updates.gateway_intent_id = String(params.transaction.buildium_transaction_id);
    }

    const { data, error } = await supabaseAdmin
      .from('payment_intent')
      .update(updates)
      .eq('org_id', params.orgId)
      .eq('id', params.intentId)
      .select(PAYMENT_INTENT_COLUMNS)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logger.error(
        { error, intentId: params.intentId, orgId: params.orgId },
        'Failed to transition payment_intent state',
      );
      throw error;
    }

    return (data as PaymentIntentRow | null) ?? null;
  }

  static async findPaymentByIntentId(orgId: string, intentId: string): Promise<PaymentRow | null> {
    const { data, error } = await supabaseAdmin
      .from('payment')
      .select('*')
      .eq('org_id', orgId)
      .eq('payment_intent_id', intentId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return (data as PaymentRow | null) ?? null;
  }
}

export default PaymentIntentService;
