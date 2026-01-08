import { supabaseAdmin } from '@/lib/db'
import type { TypedSupabaseClient } from '@/lib/db'
import { getOrgGlSettingsOrThrow } from '@/lib/gl-settings'
import type { Database, TablesInsert } from '@/types/database'
import { postingRules, computeNetAmount, logRuleEvent } from './posting-rules'
import type { LeaseContext, PostingEvent } from './posting-events'

type TransactionInsert = TablesInsert<'transactions'>

export class PostingEngine {
  private db: TypedSupabaseClient

  constructor(dbClient?: TypedSupabaseClient) {
    this.db = dbClient ?? supabaseAdmin
    if (!this.db) {
      throw new Error('Supabase client not configured for PostingEngine')
    }
  }

  async postEvent(event: PostingEvent): Promise<{ transactionId: string }> {
    const rule = postingRules[event.eventType]
    if (!rule) throw new Error(`No posting rule registered for ${event.eventType}`)

    const leaseContext = await this.loadLeaseContext(event)
    const glSettings = await getOrgGlSettingsOrThrow(event.orgId)

    if (rule.validate) {
      await rule.validate(event, glSettings)
    }

    const scope = this.resolveScope(event, leaseContext)
    const { lines, headerOverrides } = await rule.generateLines({
      event,
      glSettings,
      leaseContext,
      scope,
      db: this.db,
    })

    if (!lines || lines.length === 0) {
      throw new Error(`Posting rule ${event.eventType} produced no lines`)
    }

    const createdAt = event.createdAt ?? new Date().toISOString()
    const postingDate = event.postingDate ?? createdAt.slice(0, 10)
    const idempotencyKey =
      event.idempotencyKey ??
      (event.externalId ? `${event.externalId}_${event.eventType}` : null)
    const leaseId = headerOverrides?.lease_id ?? this.extractLeaseId(event) ?? leaseContext?.lease_id ?? null
    const accountEntityType =
      headerOverrides?.account_entity_type ??
      event.accountEntityType ??
      (leaseContext ? ('Rental' as const) : null)
    const accountEntityId =
      headerOverrides?.account_entity_id ??
      event.accountEntityId ??
      (leaseContext?.buildium_property_id ?? null)
    const reversalOf =
      headerOverrides?.reversal_of_transaction_id ??
      (event.eventType === 'reversal'
        ? (event.eventData as { originalTransactionId?: string }).originalTransactionId ?? null
        : null)
    const property_id = headerOverrides?.property_id ?? scope.propertyId ?? null
    const unit_id = headerOverrides?.unit_id ?? scope.unitId ?? null
    const memo = headerOverrides?.memo ?? (event.eventData as { memo?: string }).memo ?? null

    const linePayload = lines.map((l) => ({
      gl_account_id: l.gl_account_id,
      amount: l.amount,
      posting_type: l.posting_type,
      memo: l.memo ?? memo,
      property_id: l.property_id ?? property_id,
      unit_id: l.unit_id ?? unit_id,
      lease_id: l.lease_id ?? leaseId,
      account_entity_type: accountEntityType,
      account_entity_id: accountEntityId,
      date: postingDate,
      created_at: createdAt,
      updated_at: createdAt,
    }))

    const header: TransactionInsert = {
      org_id: event.orgId,
      transaction_type: headerOverrides?.transaction_type ?? 'GeneralJournalEntry',
      status: headerOverrides?.status,
      memo,
      date: postingDate,
      created_at: headerOverrides?.created_at ?? createdAt,
      updated_at: headerOverrides?.updated_at ?? createdAt,
      idempotency_key: idempotencyKey,
      total_amount: headerOverrides?.total_amount ?? computeNetAmount(lines),
      lease_id: leaseId,
      property_id,
      unit_id,
      account_entity_type: accountEntityType ?? undefined,
      account_entity_id: accountEntityId ?? undefined,
      reversal_of_transaction_id: reversalOf ?? undefined,
      buildium_lease_id: headerOverrides?.buildium_lease_id ?? leaseContext?.buildium_lease_id ?? undefined,
      buildium_property_id:
        headerOverrides?.buildium_property_id ?? leaseContext?.buildium_property_id ?? undefined,
      buildium_unit_id: headerOverrides?.buildium_unit_id ?? leaseContext?.buildium_unit_id ?? undefined,
    }

    const { data, error } = await this.db.rpc('post_transaction', {
      p_header: header as unknown as Database['public']['Tables']['transactions']['Insert'],
      p_lines: linePayload as unknown as Database['public']['Tables']['transaction_lines']['Insert'][],
      p_idempotency_key: idempotencyKey,
      p_validate_balance: true,
    })
    if (error) throw error

    const transactionId =
      (typeof data === 'string' && data) ||
      (Array.isArray(data) && data.length ? (data[0] as string) : null) ||
      ((data as { id?: string })?.id ?? null)

    if (!transactionId) {
      throw new Error('post_transaction did not return a transaction id')
    }

    logRuleEvent(event, transactionId)
    return { transactionId }
  }

  private async loadLeaseContext(event: PostingEvent): Promise<LeaseContext | undefined> {
    const leaseId = this.extractLeaseId(event)
    if (!leaseId) return undefined

    const { data, error } = await this.db
      .from('lease')
      .select(
        'id, org_id, property_id, unit_id, buildium_property_id, buildium_unit_id, buildium_lease_id'
      )
      .eq('id', leaseId)
      .maybeSingle()

    if (error) throw error
    if (!data) return undefined
    return {
      lease_id: data.id ?? leaseId,
      org_id: data.org_id ?? null,
      property_id: data.property_id ?? null,
      unit_id: data.unit_id ?? null,
      buildium_property_id: data.buildium_property_id ?? null,
      buildium_unit_id: data.buildium_unit_id ?? null,
      buildium_lease_id: data.buildium_lease_id ?? null,
    }
  }

  private extractLeaseId(event: PostingEvent): number | null | undefined {
    const leaseId = (event.eventData as { leaseId?: number | null })?.leaseId
    if (leaseId === undefined) return undefined
    if (leaseId === null) return null
    return Number.isFinite(Number(leaseId)) ? Number(leaseId) : undefined
  }

  private resolveScope(event: PostingEvent, leaseContext?: LeaseContext) {
    return {
      propertyId: event.propertyId ?? leaseContext?.property_id ?? null,
      unitId: event.unitId ?? leaseContext?.unit_id ?? null,
    }
  }
}
