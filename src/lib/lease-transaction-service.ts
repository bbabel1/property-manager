import { createBuildiumClient, defaultBuildiumConfig } from './buildium-client'
import { supabase, supabaseAdmin } from './db'
import { logger } from './logger'
import type { Database } from '@/types/database'
import type {
  BuildiumLeaseTransaction,
  BuildiumLeaseTransactionCreate,
  BuildiumLeaseTransactionUpdate,
  BuildiumRecurringTransaction,
  BuildiumRecurringTransactionCreate,
  BuildiumRecurringTransactionUpdate,
} from '@/types/buildium'
import { mapLeaseTransactionFromBuildium, upsertLeaseTransactionWithLines } from './buildium-mappers'

export type TransactionRow = Database['public']['Tables']['transactions']['Row']

function ensureClient() {
  return createBuildiumClient({
    ...defaultBuildiumConfig,
    clientId: process.env.BUILDIUM_CLIENT_ID || '',
    clientSecret: process.env.BUILDIUM_CLIENT_SECRET || ''
  })
}

export class LeaseTransactionService {
  // List Lease Transactions from Buildium (optionally persist headers only)
  static async listFromBuildium(leaseId: number, params?: {
    orderby?: string
    offset?: number
    limit?: number
    persist?: boolean
  }): Promise<BuildiumLeaseTransaction[]> {
    const client = ensureClient()
    const qp = new URLSearchParams()
    if (params?.orderby) qp.set('orderby', params.orderby)
    if (typeof params?.offset === 'number') qp.set('offset', String(params.offset))
    if (typeof params?.limit === 'number') qp.set('limit', String(params.limit))

    const items = await (client as any).makeRequest<BuildiumLeaseTransaction[]>(
      'GET',
      `/leases/${leaseId}/transactions?${qp.toString()}`
    )

    if (params?.persist) {
      for (const tx of items) {
        try {
          const header = mapLeaseTransactionFromBuildium(tx)
          const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('buildium_transaction_id', header.buildium_transaction_id)
            .single()

          if (existing) {
            await supabase.from('transactions').update({ ...header, updated_at: new Date().toISOString() }).eq('id', existing.id)
          } else {
            await supabase.from('transactions').insert({ ...header, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          }
        } catch (e) {
          logger.error({ txId: (tx as any)?.Id, error: (e as Error).message }, 'Failed to persist lease transaction header')
        }
      }
    }

    return items
  }

  // Get one Lease Transaction from Buildium (optionally persist full transaction + lines)
  static async getFromBuildium(leaseId: number, transactionId: number, persist = false): Promise<BuildiumLeaseTransaction | null> {
    const client = ensureClient()
    const tx = await (client as any).makeRequest<BuildiumLeaseTransaction>('GET', `/leases/${leaseId}/transactions/${transactionId}`).catch(() => null)
    if (!tx) return null

    if (persist) {
      try {
        await upsertLeaseTransactionWithLines(tx, supabase)
      } catch (e) {
        logger.error({ transactionId, error: (e as Error).message }, 'Failed to persist lease transaction with lines')
      }
    }

    return tx
  }

  // Create in Buildium, then upsert into DB
  static async createInBuildiumAndDB(leaseId: number, payload: BuildiumLeaseTransactionCreate): Promise<{ buildium: BuildiumLeaseTransaction; localId?: string }> {
    const client = ensureClient()
    const created = await (client as any).makeRequest<BuildiumLeaseTransaction>('POST', `/leases/${leaseId}/transactions`, payload)
    const { transactionId } = await upsertLeaseTransactionWithLines(created, supabase)
    return { buildium: created, localId: transactionId }
  }

  // Update in Buildium, then upsert into DB
  static async updateInBuildiumAndDB(leaseId: number, transactionId: number, payload: BuildiumLeaseTransactionUpdate): Promise<{ buildium: BuildiumLeaseTransaction; localId?: string }> {
    const client = ensureClient()
    const updated = await (client as any).makeRequest<BuildiumLeaseTransaction>('PUT', `/leases/${leaseId}/transactions/${transactionId}`, payload)
    const { transactionId: local } = await upsertLeaseTransactionWithLines(updated, supabase)
    return { buildium: updated, localId: local }
  }

  // Recurring transactions
  static async listRecurring(leaseId: number): Promise<BuildiumRecurringTransaction[]> {
    const client = ensureClient()
    return (client as any).makeRequest<BuildiumRecurringTransaction[]>('GET', `/leases/${leaseId}/recurringtransactions`)
  }

  static async getRecurring(leaseId: number, id: number): Promise<BuildiumRecurringTransaction> {
    const client = ensureClient()
    return (client as any).makeRequest<BuildiumRecurringTransaction>('GET', `/leases/${leaseId}/recurringtransactions/${id}`)
  }

  static async createRecurring(leaseId: number, payload: BuildiumRecurringTransactionCreate): Promise<BuildiumRecurringTransaction> {
    const client = ensureClient()
    return (client as any).makeRequest<BuildiumRecurringTransaction>('POST', `/leases/${leaseId}/recurringtransactions`, payload)
  }

  static async updateRecurring(leaseId: number, id: number, payload: BuildiumRecurringTransactionUpdate): Promise<BuildiumRecurringTransaction> {
    const client = ensureClient()
    return (client as any).makeRequest<BuildiumRecurringTransaction>('PUT', `/leases/${leaseId}/recurringtransactions/${id}`, payload)
  }

  static async deleteRecurring(leaseId: number, id: number): Promise<void> {
    const client = ensureClient()
    await (client as any).makeRequest<void>('DELETE', `/leases/${leaseId}/recurringtransactions/${id}`)
  }
}

export default LeaseTransactionService
