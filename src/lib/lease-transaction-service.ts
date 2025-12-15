import { createBuildiumClient, defaultBuildiumConfig } from './buildium-client';
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

const normalizeBuildiumBaseUrl = (raw: string): string => {
  if (!raw) return raw;
  const trimmed = raw.replace(/\/+$/, '');
  if (trimmed.toLowerCase().endsWith('/v1')) {
    return trimmed;
  }
  return `${trimmed}/v1`;
};

function ensureClient(): LeaseRequestClient {
  const baseUrl = normalizeBuildiumBaseUrl(
    process.env.BUILDIUM_BASE_URL || defaultBuildiumConfig.baseUrl || '',
  );
  return createBuildiumClient({
    ...defaultBuildiumConfig,
    baseUrl,
    clientId: process.env.BUILDIUM_CLIENT_ID || '',
    clientSecret: process.env.BUILDIUM_CLIENT_SECRET || '',
  }) as unknown as LeaseRequestClient;
}

type LeaseRequestClient = {
  makeRequest: (method: string, endpoint: string, payload?: unknown) => Promise<unknown>;
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

export class LeaseTransactionService {
  // List Lease Transactions from Buildium (optionally persist headers only)
  static async listFromBuildium(
    leaseId: number,
    params?: {
      orderby?: string;
      offset?: number;
      limit?: number;
      persist?: boolean;
    },
  ): Promise<BuildiumLeaseTransaction[]> {
    const client = ensureClient();
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
          if (existing) {
            await supabaseAdmin
              .from('transactions')
              .update({ ...header, updated_at: timestamp })
              .eq('id', existing.id);
          } else {
            await supabaseAdmin
              .from('transactions')
              .insert({
                ...header,
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
  ): Promise<BuildiumLeaseTransaction | null> {
    const client = ensureClient();
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
  ): Promise<{ buildium: BuildiumLeaseTransaction; localId?: string }> {
    const client = ensureClient();
    const suffix = resolveTransactionCreateSuffix(payload);
    const normalizedPayload = ensureDateField(payload);
    const created = await requestLeaseEndpoint<BuildiumLeaseTransaction>(
      client,
      'POST',
      leaseId,
      suffix,
      normalizedPayload,
    );
    const { transactionId } = await upsertLeaseTransactionWithLines(created, supabaseAdmin);
    return { buildium: created, localId: transactionId };
  }

  // Update in Buildium, then upsert into DB
  static async updateInBuildiumAndDB(
    leaseId: number,
    transactionId: number,
    payload: BuildiumLeaseTransactionUpdate,
  ): Promise<{ buildium: BuildiumLeaseTransaction; localId?: string }> {
    const client = ensureClient();
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
  static async listRecurring(leaseId: number): Promise<BuildiumRecurringTransaction[]> {
    const client = ensureClient();
    return requestLeaseEndpoint<BuildiumRecurringTransaction[]>(
      client,
      'GET',
      leaseId,
      '/recurringtransactions',
    );
  }

  static async getRecurring(leaseId: number, id: number): Promise<BuildiumRecurringTransaction> {
    const client = ensureClient();
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
  ): Promise<BuildiumRecurringTransaction> {
    const client = ensureClient();
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
  ): Promise<BuildiumRecurringTransaction> {
    const client = ensureClient();
    return requestLeaseEndpoint<BuildiumRecurringTransaction>(
      client,
      'PUT',
      leaseId,
      `/recurringtransactions/${id}`,
      payload,
    );
  }

  static async deleteRecurring(leaseId: number, id: number): Promise<void> {
    const client = ensureClient();
    await requestLeaseEndpoint<void>(client, 'DELETE', leaseId, `/recurringtransactions/${id}`);
  }
}

export default LeaseTransactionService;
