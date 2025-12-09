import { supabase as supa, supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'

type Line = { gl_account_id: string; amount: number; dr_cr: 'DR'|'CR'; memo?: string }

export async function createCharge(params: { lease_id: number|string; date: string; memo?: string; lines: Line[]; idempotency_key?: string; correlation_id?: string }) {
  const db = supabaseAdmin || supa
  const total = params.lines.reduce((s, l) => s + Number(l.amount || 0) * (l.dr_cr === 'DR' ? 1 : -1), 0)
  // Convert to absolute total for header; lines hold signs via dr_cr
  const header = {
    lease_id: typeof params.lease_id === 'string' ? params.lease_id : Number(params.lease_id),
    date: params.date,
    memo: params.memo || null,
    total_amount: total,
    transaction_type: 'charge' as any,
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
  try {
    const { data: lease } = await db
      .from('lease')
      .select('org_id, buildium_lease_id')
      .eq('id', header.lease_id as any)
      .maybeSingle()
    if (lease) {
      ;(header as any).org_id = (lease as any).org_id ?? null
      ;(header as any).buildium_lease_id = (lease as any).buildium_lease_id ?? null
    }
  } catch {}

  const { data: txn, error } = await db.from('transactions').insert(header).select('id').single()
  if (error) throw error
  const txid = txn.id
  // Load more lease context for lines
  let leaseRow: any = null
  try {
    const { data } = await db
      .from('lease')
      .select('property_id, unit_id, buildium_property_id, buildium_unit_id, buildium_lease_id')
      .eq('id', header.lease_id as any)
      .maybeSingle()
    leaseRow = data || null
  } catch {}

  const rows = params.lines.map(l => ({
    transaction_id: txid,
    date: params.date,
    gl_account_id: l.gl_account_id,
    amount: Math.abs(Number(l.amount || 0)),
    memo: l.memo || null,
    posting_type: l.dr_cr === 'DR' ? 'Debit' : 'Credit',
    account_entity_type: 'Rental' as any,
    account_entity_id: leaseRow?.buildium_property_id ?? null,
    property_id: leaseRow?.property_id ?? null,
    unit_id: leaseRow?.unit_id ?? null,
    
    buildium_unit_id: leaseRow?.buildium_unit_id ?? null,
    buildium_lease_id: leaseRow?.buildium_lease_id ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lease_id: header.lease_id as any
  }))
  const { error: lineErr } = await db.from('transaction_lines').insert(rows)
  if (lineErr) throw lineErr
  try { logger.info({ correlation_id: params.correlation_id || params.idempotency_key || null, lease_id: header.lease_id, idempotency_key: header.idempotency_key, transaction_id: txid }, 'Posted charge lines') } catch {}
  return { id: txid }
}
