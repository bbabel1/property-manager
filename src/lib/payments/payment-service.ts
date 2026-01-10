import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { PaymentIntentState, PaymentRow, TransactionRow } from '@/types/payments';

type CreateFromTransactionParams = {
  orgId: string;
  intentId: string;
  transactionId: string;
  gatewayTransactionId?: string | number | null;
  payerId?: string | null;
  payerType?: string | null;
  paymentMethod?: PaymentRow['payment_method'];
  amount?: number | null;
};

type ManualReturnParams = {
  paymentId: string;
  orgId: string;
  returnReasonCode?: string | null;
  returnedAt?: string | null;
};

type ChargebackParams = {
  paymentId: string;
  orgId: string;
  chargebackId?: string | null;
  disputedAt?: string | null;
};

const isFailureCodeCache = new Map<string, boolean>();

async function normalizeFailure(code: string | null): Promise<string | null> {
  if (!code) return null;
  const { data, error } = await supabaseAdmin
    .from('buildium_failure_codes')
    .select('normalized_code')
    .eq('raw_code', code)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.normalized_code ?? null;
}

async function isFailureCode(code: string | null): Promise<boolean> {
  if (!code) return false;
  if (isFailureCodeCache.has(code)) {
    return Boolean(isFailureCodeCache.get(code));
  }
  const normalized = await normalizeFailure(code);
  const result = normalized !== null;
  isFailureCodeCache.set(code, result);
  return result;
}

function deriveSettledAt(transaction: TransactionRow): string | null {
  if (transaction.internal_transaction_result_date) {
    return new Date(transaction.internal_transaction_result_date).toISOString();
  }
  if (!transaction.is_internal_transaction || transaction.is_internal_transaction === null) {
    return transaction.created_at ?? null;
  }
  return null;
}

async function deriveStateFromTransaction(transaction: TransactionRow): Promise<PaymentIntentState> {
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

export class PaymentService {
  static async createFromTransaction(params: CreateFromTransactionParams): Promise<PaymentRow | null> {
    const state = await deriveStateFromTransaction(
      (await this.getTransaction(params.transactionId)) as TransactionRow,
    );
    const settledAt = deriveSettledAt((await this.getTransaction(params.transactionId)) as TransactionRow);

    const insertPayload = {
      payment_intent_id: params.intentId,
      transaction_id: params.transactionId,
      org_id: params.orgId,
      gateway_transaction_id:
        params.gatewayTransactionId != null ? String(params.gatewayTransactionId) : null,
      payer_id: params.payerId ?? null,
      payer_type: params.payerType ?? null,
      payment_method: params.paymentMethod ?? null,
      amount: params.amount ?? null,
      state,
      normalized_state: state,
      settled_at: settledAt,
    };

    const { data, error } = await supabaseAdmin
      .from('payment')
      .insert(insertPayload)
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint hit: fetch existing
        return this.getByTransactionId(params.transactionId);
      }
      logger.error({ error, params }, 'Failed to create payment from transaction');
      throw error;
    }

    return (data as PaymentRow | null) ?? null;
  }

  static async updateFromBuildiumWebhook(
    transactionId: string,
    buildiumTransaction: TransactionRow,
  ): Promise<PaymentRow | null> {
    const state = await deriveStateFromTransaction(buildiumTransaction);
    const settledAt = deriveSettledAt(buildiumTransaction);

    const { data, error } = await supabaseAdmin
      .from('payment')
      .update({
        state,
        normalized_state: state,
        settled_at: settledAt,
        gateway_transaction_id:
          buildiumTransaction.buildium_transaction_id != null
            ? String(buildiumTransaction.buildium_transaction_id)
            : null,
      })
      .eq('transaction_id', transactionId)
      .select('*')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logger.error({ error, transactionId }, 'Failed to update payment from Buildium webhook');
      throw error;
    }

    return (data as PaymentRow | null) ?? null;
  }

  static async recordReturn(params: ManualReturnParams): Promise<PaymentRow | null> {
    const { data, error } = await supabaseAdmin
      .from('payment')
      .update({
        state: 'returned',
        normalized_return_reason_code: params.returnReasonCode ?? null,
        returned_at: params.returnedAt ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.paymentId)
      .eq('org_id', params.orgId)
      .select('*')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logger.error({ error, paymentId: params.paymentId }, 'Failed to record payment return');
      throw error;
    }

    return (data as PaymentRow | null) ?? null;
  }

  static async recordChargeback(params: ChargebackParams): Promise<PaymentRow | null> {
    const { data, error } = await supabaseAdmin
      .from('payment')
      .update({
        state: 'disputed',
        chargeback_id: params.chargebackId ?? null,
        disputed_at: params.disputedAt ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.paymentId)
      .eq('org_id', params.orgId)
      .select('*')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logger.error({ error, paymentId: params.paymentId }, 'Failed to record chargeback');
      throw error;
    }

    return (data as PaymentRow | null) ?? null;
  }

  static async resolveChargeback(
    orgId: string,
    paymentId: string,
    won: boolean,
  ): Promise<PaymentRow | null> {
    const state = won ? 'chargeback_won' : 'chargeback_loss';
    const { data, error } = await supabaseAdmin
      .from('payment')
      .update({
        state,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .eq('org_id', orgId)
      .select('*')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      logger.error({ error, paymentId }, 'Failed to resolve chargeback');
      throw error;
    }

    return (data as PaymentRow | null) ?? null;
  }

  static async getByTransactionId(transactionId: string): Promise<PaymentRow | null> {
    const { data, error } = await supabaseAdmin
      .from('payment')
      .select('*')
      .eq('transaction_id', transactionId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return (data as PaymentRow | null) ?? null;
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

  private static async getTransaction(transactionId: string): Promise<TransactionRow> {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select(
        'id, org_id, is_internal_transaction, internal_transaction_is_pending, internal_transaction_result_code, internal_transaction_result_date, created_at, buildium_transaction_id, total_amount, payment_method, payee_tenant_id',
      )
      .eq('id', transactionId)
      .maybeSingle();
    if (error || !data) {
      throw error || new Error('Transaction not found');
    }
    return data as TransactionRow;
  }
}

export default PaymentService;
