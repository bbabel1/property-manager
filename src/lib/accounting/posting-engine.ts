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
    const rawLeaseId = headerOverrides?.lease_id ?? this.extractLeaseId(event) ?? leaseContext?.lease_id ?? null
    // Ensure lease_id is a number (bigint), not a UUID string - coerce to number if possible, filter out non-numeric strings
    const leaseId: number | null = rawLeaseId != null && typeof rawLeaseId === 'number' 
      ? rawLeaseId 
      : (typeof rawLeaseId === 'string' && /^\d+$/.test(rawLeaseId) 
          ? Number(rawLeaseId) 
          : null)
    const accountEntityType = event.accountEntityType ?? (leaseContext ? ('Rental' as const) : null)
    const accountEntityId = event.accountEntityId ?? (leaseContext?.buildium_property_id ?? null)
    const reversalOf =
      event.eventType === 'reversal'
        ? (event.eventData as { originalTransactionId?: string }).originalTransactionId ?? null
        : null
    const memo = headerOverrides?.memo ?? (event.eventData as { memo?: string }).memo ?? null

    const linePayload = lines.map((l) => ({
      gl_account_id: l.gl_account_id,
      amount: l.amount,
      posting_type: l.posting_type,
      memo: l.memo ?? memo,
      property_id: l.property_id ?? scope.propertyId ?? null,
      unit_id: l.unit_id ?? scope.unitId ?? null,
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
      status: headerOverrides?.status ?? ('' as Database['public']['Enums']['transaction_status_enum']), // Default to empty string to match database default
      memo,
      email_receipt: headerOverrides?.email_receipt ?? false,
      print_receipt: headerOverrides?.print_receipt ?? false,
      date: postingDate,
      created_at: headerOverrides?.created_at ?? createdAt,
      updated_at: headerOverrides?.updated_at ?? createdAt,
      total_amount: headerOverrides?.total_amount ?? computeNetAmount(lines),
      ...(leaseId != null && typeof leaseId === 'number' ? { lease_id: leaseId } : {}),
      bank_gl_account_id: headerOverrides?.bank_gl_account_id ?? undefined,
      bank_gl_account_buildium_id: headerOverrides?.bank_gl_account_buildium_id ?? undefined,
      buildium_application_id: headerOverrides?.buildium_application_id ?? undefined,
      buildium_bill_id: headerOverrides?.buildium_bill_id ?? undefined,
      buildium_transaction_id: headerOverrides?.buildium_transaction_id ?? undefined,
      check_number: headerOverrides?.check_number ?? undefined,
      reference_number: headerOverrides?.reference_number ?? undefined,
      is_internal_transaction: headerOverrides?.is_internal_transaction ?? undefined,
      is_recurring: headerOverrides?.is_recurring ?? undefined,
      buildium_lease_id: headerOverrides?.buildium_lease_id ?? leaseContext?.buildium_lease_id ?? undefined,
      buildium_unit_id: headerOverrides?.buildium_unit_id ?? leaseContext?.buildium_unit_id ?? undefined,
    }

    const { data, error } = await (this.db as any).rpc('post_transaction', {
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

  private buildMetadata(
    event: PostingEvent,
    override?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    const hints = event.metadata
    const meta: Record<string, unknown> = {}

    if (hints?.chargeId) meta.charge_id = hints.chargeId
    if (hints?.paymentId) meta.payment_id = hints.paymentId
    if (hints?.reversalOfPaymentId) meta.reversal_of_payment_id = hints.reversalOfPaymentId
    if (hints?.nsfFee) meta.nsf_fee = true
    if (hints?.allocations) meta.allocations = hints.allocations

    if (override && typeof override === 'object') {
      Object.assign(meta, override as Record<string, unknown>)
    }

    if (Object.keys(meta).length === 0) return undefined
    return meta
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
      lease_id: leaseId ?? null,
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
