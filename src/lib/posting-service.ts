import { supabase as supa, supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { TablesInsert } from '@/types/database'

type Line = { gl_account_id: string; amount: number; dr_cr: 'DR'|'CR'; memo?: string }
type TransactionLineInsert = TablesInsert<'transaction_lines'>

export async function createCharge(params: { lease_id: number|string; date: string; memo?: string; lines: Line[]; idempotency_key?: string; correlation_id?: string }) {
  const db = supabaseAdmin || supa
  const total = params.lines.reduce((s, l) => s + Number(l.amount || 0) * (l.dr_cr === 'DR' ? 1 : -1), 0)
  const leaseId = Number(params.lease_id)
  const normalizedLeaseId = Number.isNaN(leaseId) ? null : leaseId
  type ChargeHeader = {
    lease_id: number | null
    date: string
    memo: string | null
    total_amount: number
    transaction_type: 'Charge'
    created_at: string
    updated_at: string
    idempotency_key: string | null
    org_id?: string | null
    buildium_lease_id?: number | null
  }
  // Convert to absolute total for header; lines hold signs via dr_cr
  const header: ChargeHeader = {
    lease_id: normalizedLeaseId,
    date: params.date,
    memo: params.memo || null,
    total_amount: total,
    transaction_type: 'Charge' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    idempotency_key: params.idempotency_key || null
  }
  // Upsert by idempotency_key
  if (header.idempotency_key) {
    const { data: existing } = await db.from('transactions').select('id').eq('idempotency_key', header.idempotency_key).maybeSingle()
    if (existing?.id) return existing
  }
  try { logger.info({ correlation_id: params.correlation_id || params.idempotency_key || null, lease_id: header.lease_id, idempotency_key: header.idempotency_key, total_amount: header.total_amount }, 'Posting charge header') } catch {}
  // Enrich header with org/buildium via lease (if available)
  if (normalizedLeaseId != null) {
    try {
      const { data: lease } = await db
        .from('lease')
        .select('org_id, buildium_lease_id')
        .eq('id', normalizedLeaseId)
        .maybeSingle()
      if (lease) {
        header.org_id = lease.org_id ?? null
        header.buildium_lease_id = lease.buildium_lease_id ?? null
      }
    } catch {}
  }

  const { data: txn, error } = await db.from('transactions').insert(header).select('id').single()
  if (error) throw error
  const txid = txn.id
  // Load more lease context for lines
  let leaseRow: {
    property_id?: string | null
    unit_id?: string | null
    buildium_property_id?: number | null
    buildium_unit_id?: number | null
    buildium_lease_id?: number | null
  } | null = null
  if (normalizedLeaseId != null) {
    try {
      const { data } = await db
        .from('lease')
        .select('property_id, unit_id, buildium_property_id, buildium_unit_id, buildium_lease_id')
        .eq('id', normalizedLeaseId)
        .maybeSingle()
      leaseRow = data || null
    } catch {}
  }

  const accountEntityType: TransactionLineInsert['account_entity_type'] = 'Rental'

  const rows: TransactionLineInsert[] = params.lines.map(l => {
    const postingType: TransactionLineInsert['posting_type'] = l.dr_cr === 'DR' ? 'Debit' : 'Credit'
    return {
      transaction_id: txid,
      date: params.date,
      gl_account_id: l.gl_account_id,
      amount: Math.abs(Number(l.amount || 0)),
      memo: l.memo || null,
      posting_type: postingType,
      account_entity_type: accountEntityType,
      account_entity_id: leaseRow?.buildium_property_id ?? null,
      property_id: leaseRow?.property_id ?? null,
      unit_id: leaseRow?.unit_id ?? null,
      buildium_unit_id: leaseRow?.buildium_unit_id ?? null,
      buildium_lease_id: leaseRow?.buildium_lease_id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lease_id: normalizedLeaseId,
    }
  })
  const { error: lineErr } = await db.from('transaction_lines').insert(rows)
  if (lineErr) throw lineErr
  try { logger.info({ correlation_id: params.correlation_id || params.idempotency_key || null, lease_id: header.lease_id, idempotency_key: header.idempotency_key, transaction_id: txid }, 'Posted charge lines') } catch {}
  return { id: txid }
}
