import { randomUUID } from 'crypto';
import { getOrgScopedBuildiumClient } from './buildium-client';
import { supabaseAdmin } from './db';
import { logger } from './logger';
import type { Database } from '@/types/database';
import type {
  BuildiumLeaseTransaction,
  BuildiumLeaseTransactionCreate,
  BuildiumLeaseTransactionUpdate,
  BuildiumRecurringTransaction,
  BuildiumRecurringTransactionCreate,
  BuildiumRecurringTransactionUpdate,
} from '@/types/buildium';
import {
  mapLeaseTransactionFromBuildium,
  upsertLeaseTransactionWithLines,
} from './buildium-mappers';

export type TransactionRow = Database['public']['Tables']['transactions']['Row'];

async function ensureClient(orgId?: string): Promise<LeaseRequestClient> {
  return getOrgScopedBuildiumClient(orgId) as unknown as LeaseRequestClient;
}

type LeaseRequestClient = {
  makeRequest: (method: string, endpoint: string, payload?: unknown) => Promise<unknown>;
};

type PaymentIntentMetadata = {
  transaction_id?: string | null;
  gateway_transaction_id?: string | number | null;
};

type PaymentIntentRow = {
  id: string;
  org_id: string;
  idempotency_key: string;
  gateway_intent_id?: string | null;
  state?: string | null;
  metadata?: PaymentIntentMetadata | null;
};

const LEASE_ENDPOINT_BASE = '/leases';

const TRANSACTION_ENDPOINT_MAP: Record<string, string> = {
  payment: '/payments',
  charge: '/charges',
  credit: '/credits',
  refund: '/refunds',
  applydeposit: '/applydeposit',
};

export function resolveTransactionCreateSuffix(
  payload: BuildiumLeaseTransactionCreate,
): string {
  const key = (payload?.TransactionType ?? '').toLowerCase();
  return TRANSACTION_ENDPOINT_MAP[key] ?? '/transactions';
}

export function ensureDateField(
  payload: BuildiumLeaseTransactionCreate,
): BuildiumLeaseTransactionCreate & { Date?: string } {
  const normalized = payload as BuildiumLeaseTransactionCreate & {
    Date?: string;
    TransactionDate?: string;
  };
  if (normalized == null) return normalized;
  if (normalized.Date && normalized.Date.length > 0) {
    return normalized;
  }
  if (normalized.TransactionDate && normalized.TransactionDate.length > 0) {
    return { ...normalized, Date: normalized.TransactionDate };
  }
  return normalized;
}

const buildLeaseEndpoint = (leaseId: number, rawSuffix: string): string => {
  const suffix = rawSuffix?.trim() ?? '';
  if (!suffix) {
    return `${LEASE_ENDPOINT_BASE}/${leaseId}`;
  }
  if (suffix.startsWith('?')) {
    return `${LEASE_ENDPOINT_BASE}/${leaseId}${suffix}`;
  }
  if (suffix.startsWith('/')) {
    return `${LEASE_ENDPOINT_BASE}/${leaseId}${suffix}`;
  }
  return `${LEASE_ENDPOINT_BASE}/${leaseId}/${suffix}`;
};

async function requestLeaseEndpoint<T>(
  client: LeaseRequestClient,
  method: string,
  leaseId: number,
  suffix: string,
  payload?: unknown,
): Promise<T> {
  const endpoint = buildLeaseEndpoint(leaseId, suffix);
  return (await client.makeRequest(method, endpoint, payload)) as T;
}

const paymentIntentClient = supabaseAdmin as unknown as {
  from: (table: string) => {
    select: (...args: unknown[]) => any;
    insert: (...args: unknown[]) => any;
    update: (...args: unknown[]) => any;
  };
};

const parsePaymentIntentMetadata = (metadata: unknown): PaymentIntentMetadata => {
  if (metadata && typeof metadata === 'object') {
    return metadata as PaymentIntentMetadata;
  }
  return {};
};

async function findPaymentIntentByKey(
  orgId: string,
  idempotencyKey: string,
): Promise<PaymentIntentRow | null> {
  const { data, error } = await paymentIntentClient
    .from('payment_intent')
    .select('id, org_id, idempotency_key, gateway_intent_id, metadata, state')
    .eq('org_id', orgId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data as PaymentIntentRow | null) ?? null;
}

async function insertPaymentIntent(params: {
  orgId: string;
  idempotencyKey: string;
  amount: number;
  paymentMethod?: string | null;
  bypassUdf?: boolean;
}): Promise<PaymentIntentRow> {
  const payload = {
    org_id: params.orgId,
    idempotency_key: params.idempotencyKey,
    amount: params.amount,
    payment_method: params.paymentMethod ?? null,
    state: 'created',
    gateway_provider: 'buildium',
    bypass_udf: params.bypassUdf ?? false,
    metadata: {},
  };

  const { data, error } = await paymentIntentClient
    .from('payment_intent')
    .insert(payload)
    .select('id, org_id, idempotency_key, gateway_intent_id, metadata, state')
    .single();

  if (error) {
    // Handle race: if already exists, fetch it
    if (error.code === '23505') {
      const existing = await findPaymentIntentByKey(params.orgId, params.idempotencyKey);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }

  return data as PaymentIntentRow;
}

async function updatePaymentIntentAfterSubmission(params: {
  intentId: string;
  orgId: string;
  transactionId: string;
  gatewayTransactionId?: number | string | null;
  existingMetadata?: PaymentIntentMetadata | null;
}) {
  const mergedMetadata: PaymentIntentMetadata = {
    ...(params.existingMetadata ?? {}),
    transaction_id: params.transactionId,
    gateway_transaction_id: params.gatewayTransactionId ?? null,
  };

  const { error } = await paymentIntentClient
    .from('payment_intent')
    .update({
      state: 'submitted',
      gateway_intent_id:
        params.gatewayTransactionId != null ? String(params.gatewayTransactionId) : null,
      metadata: mergedMetadata,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.intentId)
    .eq('org_id', params.orgId);

  if (error) {
    logger.error({ error, intentId: params.intentId }, 'Failed to update payment_intent after submission');
  }
}

async function findTransactionIdByBuildiumId(buildiumId: unknown): Promise<string | null> {
  const parsed = typeof buildiumId === 'number' ? buildiumId : Number(buildiumId);
  if (!Number.isFinite(parsed)) return null;

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('buildium_transaction_id', parsed)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data?.id ?? null;
}

export class LeaseTransactionService {
  // List Lease Transactions from Buildium (optionally persist headers only)
  static async listFromBuildium(
    leaseId: number,
    params?: {
      orderby?: string;
      offset?: number;
      limit?: number;
      persist?: boolean;
      orgId?: string;
    },
  ): Promise<BuildiumLeaseTransaction[]> {
    const client = await ensureClient(params?.orgId);
    const qp = new URLSearchParams();
    if (params?.orderby) qp.set('orderby', params.orderby);
    if (typeof params?.offset === 'number') qp.set('offset', String(params.offset));
    if (typeof params?.limit === 'number') qp.set('limit', String(params.limit));

    const query = qp.toString();
    const suffix = query ? `/transactions?${query}` : '/transactions';
    const items = await requestLeaseEndpoint<BuildiumLeaseTransaction[]>(
      client,
      'GET',
      leaseId,
      suffix,
    );

    if (params?.persist) {
      let orgIdForHeader = params.orgId ?? null;
      if (!orgIdForHeader) {
        const { data: leaseRow, error: leaseErr } = await supabaseAdmin
          .from('lease')
          .select('org_id')
          .eq('buildium_lease_id', leaseId)
          .maybeSingle();
        if (leaseErr) {
          logger.error(
            { leaseId, error: leaseErr.message },
            'Failed to resolve org for lease transactions persistence',
          );
        }
        orgIdForHeader = (leaseRow as { org_id?: string | null } | null)?.org_id ?? null;
      }

      if (!orgIdForHeader) {
        logger.warn({ leaseId }, 'Skipping lease transaction persistence: org_id not resolved');
        return items;
      }

      for (const tx of items) {
        try {
          const header = mapLeaseTransactionFromBuildium(tx);
          const buildiumTxId = header.buildium_transaction_id;
          let existing: { id: string } | null = null;
          if (buildiumTxId != null) {
            const { data } = await supabaseAdmin
              .from('transactions')
              .select('id')
              .eq('buildium_transaction_id', buildiumTxId)
              .maybeSingle();
            existing = data ?? null;
          }

          const timestamp = new Date().toISOString();
          const headerWithOrg = { ...header, org_id: orgIdForHeader };
          if (existing) {
            await supabaseAdmin
              .from('transactions')
              .update({ ...headerWithOrg, updated_at: timestamp })
              .eq('id', existing.id);
          } else {
            await supabaseAdmin
              .from('transactions')
              .insert({
                ...headerWithOrg,
                created_at: timestamp,
                updated_at: timestamp,
              });
          }
        } catch (e) {
          const txId = (tx as Partial<BuildiumLeaseTransaction>)?.Id;
          logger.error(
            { txId, error: (e as Error).message },
            'Failed to persist lease transaction header',
          );
        }
      }
    }

    return items;
  }

  // Get one Lease Transaction from Buildium (optionally persist full transaction + lines)
  static async getFromBuildium(
    leaseId: number,
    transactionId: number,
    persist = false,
    orgId?: string,
  ): Promise<BuildiumLeaseTransaction | null> {
    const client = await ensureClient(orgId);
    const tx = await requestLeaseEndpoint<BuildiumLeaseTransaction>(
      client,
      'GET',
      leaseId,
      `/transactions/${transactionId}`,
    ).catch(() => null);
    if (!tx) return null;

    if (persist) {
      try {
        await upsertLeaseTransactionWithLines(tx, supabaseAdmin);
      } catch (e) {
        logger.error(
          { transactionId, error: (e as Error).message },
          'Failed to persist lease transaction with lines',
        );
      }
    }

    return tx;
  }

  // Create in Buildium, then upsert into DB
  static async createInBuildiumAndDB(
  leaseId: number,
  payload: BuildiumLeaseTransactionCreate,
  orgId?: string,
  options?: { idempotencyKey?: string; bypassUdf?: boolean },
): Promise<{
    buildium: BuildiumLeaseTransaction | null;
    localId?: string;
    buildiumId?: number | string | null;
    intentId?: string;
    idempotencyKey?: string;
    reused?: boolean;
    intentState?: PaymentIntentRow['state'] | null;
  }> {
    const client = await ensureClient(orgId);
    const suffix = resolveTransactionCreateSuffix(payload);
    const normalizedPayload = ensureDateField(payload);

    const isPayment =
      (payload?.TransactionType ?? payload?.TransactionTypeEnum ?? '').toLowerCase() === 'payment';
    const intendedAmount = Number(
      (payload as { Amount?: number; TotalAmount?: number })?.Amount ??
        (payload as { Amount?: number; TotalAmount?: number })?.TotalAmount ??
        0,
    );
    const shouldEnforceIdempotency = isPayment && !!orgId && Number.isFinite(intendedAmount);
    const intentKey = options?.idempotencyKey?.trim() || (shouldEnforceIdempotency ? randomUUID() : undefined);
    let intent: PaymentIntentRow | null = null;
    let intentState: PaymentIntentRow['state'] | null = null;

    if (shouldEnforceIdempotency && intentKey) {
      const existing = await findPaymentIntentByKey(orgId as string, intentKey);
      const existingMetadata = parsePaymentIntentMetadata(existing?.metadata);
      const existingTransactionId =
        existingMetadata?.transaction_id ??
        (existing?.gateway_intent_id
          ? await findTransactionIdByBuildiumId(existing.gateway_intent_id)
          : null) ??
        (existingMetadata?.gateway_transaction_id
          ? await findTransactionIdByBuildiumId(existingMetadata.gateway_transaction_id)
          : null);

      if (existing && (existingTransactionId || existingMetadata?.gateway_transaction_id)) {
        intentState = existing.state ?? null;
        return {
          buildium: null,
          localId: existingTransactionId ?? undefined,
          buildiumId: existingMetadata?.gateway_transaction_id ?? existing?.gateway_intent_id ?? null,
          intentId: existing.id,
          idempotencyKey: intentKey,
          reused: true,
          intentState,
        };
      }

      intent =
        existing ??
        (await insertPaymentIntent({
          orgId,
          idempotencyKey: intentKey,
          amount: intendedAmount,
          paymentMethod: (payload as { PaymentMethod?: string })?.PaymentMethod ?? null,
          bypassUdf: options?.bypassUdf,
        }));
      intentState = intent?.state ?? null;
    }

    const created = await requestLeaseEndpoint<BuildiumLeaseTransaction>(
      client,
      'POST',
      leaseId,
      suffix,
      normalizedPayload,
    );
    const { transactionId } = await upsertLeaseTransactionWithLines(created, supabaseAdmin);

    if (intent && orgId) {
      await updatePaymentIntentAfterSubmission({
        intentId: intent.id,
        orgId,
        transactionId,
        gatewayTransactionId: created?.Id ?? null,
        existingMetadata: parsePaymentIntentMetadata(intent.metadata),
      });
      intentState = 'submitted';
    }

    return {
      buildium: created,
      localId: transactionId,
      buildiumId: created?.Id ?? null,
      intentId: intent?.id,
      idempotencyKey: intentKey,
      reused: false,
      intentState,
    };
  }

  // Update in Buildium, then upsert into DB
  static async updateInBuildiumAndDB(
    leaseId: number,
    transactionId: number,
    payload: BuildiumLeaseTransactionUpdate,
    orgId?: string,
  ): Promise<{ buildium: BuildiumLeaseTransaction; localId?: string }> {
    const client = await ensureClient(orgId);
    const updated = await requestLeaseEndpoint<BuildiumLeaseTransaction>(
      client,
      'PUT',
      leaseId,
      `/transactions/${transactionId}`,
      payload,
    );
    const { transactionId: local } = await upsertLeaseTransactionWithLines(updated, supabaseAdmin);
    return { buildium: updated, localId: local };
  }

  // Recurring transactions
  static async listRecurring(leaseId: number, orgId?: string): Promise<BuildiumRecurringTransaction[]> {
    const client = await ensureClient(orgId);
    return requestLeaseEndpoint<BuildiumRecurringTransaction[]>(
      client,
      'GET',
      leaseId,
      '/recurringtransactions',
    );
  }

  static async getRecurring(leaseId: number, id: number, orgId?: string): Promise<BuildiumRecurringTransaction> {
    const client = await ensureClient(orgId);
    return requestLeaseEndpoint<BuildiumRecurringTransaction>(
      client,
      'GET',
      leaseId,
      `/recurringtransactions/${id}`,
    );
  }

  static async createRecurring(
    leaseId: number,
    payload: BuildiumRecurringTransactionCreate,
    orgId?: string,
  ): Promise<BuildiumRecurringTransaction> {
    const client = await ensureClient(orgId);
    return requestLeaseEndpoint<BuildiumRecurringTransaction>(
      client,
      'POST',
      leaseId,
      '/recurringtransactions',
      payload,
    );
  }

  static async updateRecurring(
    leaseId: number,
    id: number,
    payload: BuildiumRecurringTransactionUpdate,
    orgId?: string,
  ): Promise<BuildiumRecurringTransaction> {
    const client = await ensureClient(orgId);
    return requestLeaseEndpoint<BuildiumRecurringTransaction>(
      client,
      'PUT',
      leaseId,
      `/recurringtransactions/${id}`,
      payload,
    );
  }

  static async deleteRecurring(leaseId: number, id: number, orgId?: string): Promise<void> {
    const client = await ensureClient(orgId);
    await requestLeaseEndpoint<void>(client, 'DELETE', leaseId, `/recurringtransactions/${id}`);
  }
}

export default LeaseTransactionService;
