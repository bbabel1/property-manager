import { supabase as supa, supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import { PostingEngine } from './accounting/posting-engine'

type Line = { gl_account_id: string; amount: number; dr_cr: 'DR' | 'CR'; memo?: string }

const engine = new PostingEngine()

export async function createCharge(params: {
  lease_id: number | string
  date: string
  memo?: string
  lines: Line[]
  idempotency_key?: string
  correlation_id?: string
}) {
  const db = supabaseAdmin || supa
  const leaseIdNum = Number(params.lease_id)
  const leaseId = Number.isNaN(leaseIdNum) ? null : leaseIdNum
  if (leaseId == null) throw new Error('createCharge requires a lease_id')

  const { data: lease, error: leaseErr } = await db
    .from('lease')
    .select('org_id, property_id, unit_id, buildium_property_id, buildium_unit_id, buildium_lease_id')
    .eq('id', leaseId)
    .maybeSingle()
  if (leaseErr) throw leaseErr
  if (!lease?.org_id) throw new Error(`createCharge missing org for lease ${leaseId}`)

  const debit = params.lines.find((l) => l.dr_cr === 'DR')
  const credit = params.lines.find((l) => l.dr_cr === 'CR')
  const amount = Number(debit?.amount ?? credit?.amount ?? 0)
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error('createCharge requires a non-zero amount')
  }

  try {
    logger.info(
      {
        correlation_id: params.correlation_id || params.idempotency_key || null,
        lease_id: leaseId,
        idempotency_key: params.idempotency_key || null,
        total_amount: amount,
      },
      'Posting charge via PostingEngine'
    )
  } catch {}

  const { transactionId } = await engine.postEvent({
    eventType: 'rent_charge',
    orgId: lease.org_id,
    propertyId: lease.property_id ?? undefined,
    unitId: lease.unit_id ?? undefined,
    postingDate: params.date,
    createdAt: new Date().toISOString(),
    accountEntityType: 'Rental',
    accountEntityId: lease.buildium_property_id ?? undefined,
    idempotencyKey: params.idempotency_key,
    eventData: {
      amount: Math.abs(amount),
      memo: params.memo,
      leaseId,
      propertyId: lease.property_id ?? undefined,
      unitId: lease.unit_id ?? undefined,
      buildiumLeaseId: lease.buildium_lease_id ?? undefined,
      debitGlAccountId: debit?.gl_account_id,
      creditGlAccountId: credit?.gl_account_id,
    },
  })

  return { id: transactionId }
}
