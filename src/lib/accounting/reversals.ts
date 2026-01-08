import { Pool, type PoolClient } from 'pg'
import { supabaseAdmin } from '@/lib/db'
import { PostingEngine } from './posting-engine'
import type { Charge } from '@/types/ar'
import PaymentReversalService from '@/lib/payments/reversal-service'

const engine = new PostingEngine()

export async function createReversal(params: {
  originalTransactionId: string
  reversalDate: string
  memo?: string
  orgId: string
}): Promise<{ reversalTransactionId: string }> {
  const db = supabaseAdmin
  const { originalTransactionId, reversalDate, memo, orgId } = params

  const { data: txn, error: txErr } = await db
    .from('transactions')
    .select(
      'id, org_id, property_id, unit_id, account_entity_type, account_entity_id, locked_at, reversal_of_transaction_id'
    )
    .eq('id', originalTransactionId)
    .maybeSingle()
  if (txErr) throw txErr
  if (!txn) throw new Error(`Transaction ${originalTransactionId} not found`)
  if (txn.org_id !== orgId) throw new Error('Transaction org mismatch')
  if (!txn.locked_at) throw new Error('Original transaction must be locked before reversal')

  const { data: already, error: alreadyErr } = await db
    .from('transactions')
    .select('id')
    .eq('reversal_of_transaction_id', originalTransactionId)
    .maybeSingle()
  if (alreadyErr) throw alreadyErr
  if (already?.id) throw new Error('Transaction already reversed')

  const { transactionId } = await engine.postEvent({
    eventType: 'reversal',
    orgId,
    propertyId: txn.property_id ?? undefined,
    unitId: txn.unit_id ?? undefined,
    accountEntityType: txn.account_entity_type as any,
    accountEntityId: txn.account_entity_id ?? undefined,
    postingDate: reversalDate,
    eventData: {
      originalTransactionId,
      memo,
    },
  })

  await db
    .from('transactions')
    .update({ reversal_of_transaction_id: originalTransactionId })
    .eq('id', transactionId)

  await db.rpc('lock_transaction', {
    p_transaction_id: transactionId,
    p_reason: memo ?? 'reversal',
    p_user_id: null,
  })

  return { reversalTransactionId: transactionId }
}

// Manual payment return (NSF) helper
export async function createNSFReversal(params: {
  paymentId: string
  orgId: string
  returnReasonCode?: string | null
  returnedAt?: string | null
  createdByUserId?: string | null
}) {
  return PaymentReversalService.createNSFReversal(params)
}

// Manual chargeback helper
export async function createChargebackReversal(params: {
  paymentId: string
  orgId: string
  chargebackId?: string | null
  disputedAt?: string | null
  createdByUserId?: string | null
}) {
  return PaymentReversalService.createChargebackReversal(params)
}

// Manual chargeback resolution helper
export async function resolveChargeback(params: {
  paymentId: string
  orgId: string
  won: boolean
  occurredAt?: string | null
  createdByUserId?: string | null
}) {
  return PaymentReversalService.resolveChargeback(params)
}

type ReversePaymentParams = {
  paymentTransactionId: string
  orgId: string
  reversalDate: string
  memo?: string | null
  nsfFeeAmount?: number | null
  nsfFeeGlAccountId?: string | null
  createNsfFee?: boolean | null
  externalId?: string | null
}

type ReversePaymentResult = {
  reversalTransactionId: string
  nsfChargeId: string | null
  updatedCharges: Charge[]
}

let reversalPool: Pool | null = null

const getPool = () => {
  if (reversalPool) return reversalPool
  const directUrl = process.env.SUPABASE_DB_URL
  const password = process.env.SUPABASE_DB_PASSWORD
  const projectRef = process.env.SUPABASE_PROJECT_REF_PRODUCTION
  const connectionString =
    directUrl ||
    (password && projectRef
      ? `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`
      : null)
  if (!connectionString) {
    throw new Error(
      'Cannot reverse payment: missing SUPABASE_DB_URL or SUPABASE_DB_PASSWORD + SUPABASE_PROJECT_REF_PRODUCTION'
    )
  }
  reversalPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  return reversalPool
}

const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // ignore rollback failures
    }
    throw error
  } finally {
    client.release()
  }
}

const mapCharge = (row: Record<string, any>): Charge => ({
  id: row.id,
  orgId: row.org_id,
  leaseId: Number(row.lease_id),
  transactionId: row.transaction_id ?? null,
  chargeScheduleId: row.charge_schedule_id ?? null,
  parentChargeId: row.parent_charge_id ?? null,
  chargeType: row.charge_type,
  amount: Number(row.amount),
  amountOpen: Number(row.amount_open),
  paidAmount: Number(row.amount) - Number(row.amount_open ?? 0),
  dueDate: row.due_date,
  description: row.description ?? null,
  isProrated: Boolean(row.is_prorated),
  prorationDays: row.proration_days ?? null,
  baseAmount: row.base_amount ?? null,
  status: row.status,
  buildiumChargeId: row.buildium_charge_id ?? null,
  externalId: row.external_id ?? null,
  source: row.source ?? null,
  createdBy: row.created_by ?? null,
  updatedBy: row.updated_by ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const computeHeaderAmount = (lines: { amount: number; posting_type: string }[]) =>
  lines.reduce((sum, l) => sum + (l.posting_type === 'Debit' ? Number(l.amount || 0) : -Number(l.amount || 0)), 0)

async function fetchGlSettings(client: PoolClient, orgId: string) {
  const { rows } = await client.query(
    `select ar_lease, rent_income, late_fee_income, tenant_deposit_liability from public.settings_gl_accounts where org_id = $1`,
    [orgId]
  )
  const gl = rows[0]
  if (!gl?.ar_lease) {
    throw new Error(`GL account settings missing for org ${orgId}`)
  }
  return gl as {
    ar_lease: string
    rent_income: string
    late_fee_income: string | null
    tenant_deposit_liability: string | null
  }
}

async function fetchReturnedPaymentPolicy(client: PoolClient, orgId: string) {
  const { rows } = await client.query(
    `select auto_create_nsf_fee, nsf_fee_amount, nsf_fee_gl_account_id from public.returned_payment_policies where org_id = $1`,
    [orgId]
  )
  return rows[0] ?? null
}

async function createReversalTransaction(params: {
  client: PoolClient
  paymentId: string
  reversalDate: string
  memo?: string | null
  orgId: string
  leaseId: number | null
  propertyId: string | null
  unitId: string | null
  idempotencyKey?: string | null
}) {
  const { client, paymentId, reversalDate, memo, orgId, leaseId, propertyId, unitId, idempotencyKey } = params
  const { rows: originalLines } = await client.query(
    `select gl_account_id, amount, posting_type, memo, property_id, unit_id, lease_id from public.transaction_lines where transaction_id = $1`,
    [paymentId]
  )
  if (!originalLines.length) {
    throw new Error(`No lines found for transaction ${paymentId}`)
  }
  const reversedLines = originalLines.map((l) => ({
    gl_account_id: l.gl_account_id,
    amount: Number(l.amount || 0),
    posting_type: l.posting_type === 'Debit' ? 'Credit' : 'Debit',
    memo: memo || l.memo || 'Reversal',
    property_id: l.property_id ?? propertyId,
    unit_id: l.unit_id ?? unitId,
    lease_id: l.lease_id ?? leaseId,
  }))
  const headerAmount = computeHeaderAmount(reversedLines)
  const { rows } = await client.query(
    `select public.post_transaction($1::jsonb, $2::jsonb, $3::text, true) as id`,
    [
      {
        org_id: orgId,
        transaction_type: 'GeneralJournalEntry',
        date: reversalDate,
        memo: memo ?? 'Reversal',
        lease_id: leaseId,
        property_id: propertyId,
        unit_id: unitId,
        reversal_of_transaction_id: paymentId,
        total_amount: headerAmount,
        idempotency_key: idempotencyKey ?? null,
        metadata: {
          reversal_of_payment_id: paymentId,
        },
      },
      reversedLines,
      idempotencyKey ?? null,
    ]
  )
  const reversalId = rows[0]?.id
  if (!reversalId) throw new Error('Failed to create reversal transaction')
  return reversalId as string
}

async function insertNsfChargeRecords(params: {
  client: PoolClient
  orgId: string
  leaseId: number | null
  amount: number
  transactionId: string
  dueDate: string
  externalId?: string | null
  memo?: string | null
}) {
  const { client, orgId, leaseId, amount, transactionId, dueDate, externalId, memo } = params
  const now = new Date().toISOString()
  const { rows: chargeRows } = await client.query(
    `
    INSERT INTO public.charges (
      org_id, lease_id, transaction_id, charge_type, amount, amount_open, due_date, description,
      status, source, external_id, created_at, updated_at, is_prorated, proration_days, base_amount, parent_charge_id
    )
    VALUES ($1,$2,$3,'late_fee',$4,$4,$5,$6,'open','nsf',$7,$8,$8,false,null,null,null)
    RETURNING *
    `,
    [orgId, leaseId, transactionId, amount, dueDate, memo ?? 'NSF fee', externalId ?? null, now]
  )
  const charge = chargeRows[0]
  const { rows: recvRows } = await client.query(
    `
    INSERT INTO public.receivables (
      org_id, lease_id, receivable_type, total_amount, paid_amount, due_date, description, status, external_id, source, created_at, updated_at
    )
    VALUES ($1,$2,'fee',$3,0,$4,$5,'open',$6,'nsf',$7,$7)
    RETURNING *
    `,
    [orgId, leaseId, amount, dueDate, memo ?? 'NSF fee', externalId ?? null, now]
  )
  return { chargeRow: charge, receivableRow: recvRows[0] }
}

async function unwindAllocations(client: PoolClient, paymentTransactionId: string): Promise<Charge[]> {
  const now = new Date().toISOString()
  const { rows: allocations } = await client.query(
    `
    SELECT pa.allocated_amount, c.*
    FROM public.payment_allocations pa
    INNER JOIN public.charges c ON c.id = pa.charge_id
    WHERE pa.payment_transaction_id = $1
    FOR UPDATE OF c
    `,
    [paymentTransactionId]
  )
  if (!allocations.length) return []

  const updatedCharges: Charge[] = []
  for (const row of allocations) {
    const allocAmount = Number(row.allocated_amount || 0)
    const newOpen = Math.min(Number(row.amount), Number(row.amount_open) + allocAmount)
    const status =
      newOpen <= 0.01 ? 'paid' : newOpen < Number(row.amount) ? 'partial' : 'open'
    const { rows: updated } = await client.query(
      `
      UPDATE public.charges
      SET amount_open = $1, status = $2, updated_at = $3
      WHERE id = $4
      RETURNING *
      `,
      [Number(newOpen.toFixed(2)), status, now, row.id]
    )
    updatedCharges.push(mapCharge(updated[0]))
  }

  await client.query(`DELETE FROM public.payment_allocations WHERE payment_transaction_id = $1`, [
    paymentTransactionId,
  ])
  return updatedCharges
}

export async function reversePaymentWithNSF(params: ReversePaymentParams): Promise<ReversePaymentResult> {
  const {
    paymentTransactionId,
    orgId,
    reversalDate,
    memo,
    nsfFeeAmount,
    nsfFeeGlAccountId,
    createNsfFee,
    externalId,
  } = params

  return withTransaction<ReversePaymentResult>(async (client) => {
    const { rows: payments } = await client.query(
      `SELECT id, org_id, lease_id, property_id, unit_id, transaction_type FROM public.transactions WHERE id = $1 FOR UPDATE`,
      [paymentTransactionId]
    )
    const payment = payments[0]
    if (!payment) throw new Error('Payment not found')
    if (payment.org_id !== orgId) throw new Error('Payment org mismatch')
    if ((payment.transaction_type || '').toLowerCase() !== 'payment') {
      throw new Error('Only payment transactions can be reversed via this endpoint')
    }

    const { rows: existingRev } = await client.query(
      `SELECT id FROM public.transactions WHERE reversal_of_transaction_id = $1 LIMIT 1`,
      [paymentTransactionId]
    )
    const existingReversalId = existingRev[0]?.id as string | undefined

    const updatedCharges = await unwindAllocations(client, paymentTransactionId)

    const reversalId =
      existingReversalId ||
      (await createReversalTransaction({
        client,
        paymentId: paymentTransactionId,
        reversalDate,
        memo: memo ?? 'Payment reversal',
        orgId: orgId,
        leaseId: payment.lease_id ?? null,
        propertyId: payment.property_id ?? null,
        unitId: payment.unit_id ?? null,
        idempotencyKey: externalId ? `reverse:${externalId}` : null,
      }))

    let nsfChargeId: string | null = null
    const policy = await fetchReturnedPaymentPolicy(client, orgId)
    const shouldCreateNsf =
      createNsfFee ??
      (policy?.auto_create_nsf_fee ?? false) ||
      Boolean(nsfFeeAmount != null && nsfFeeAmount > 0)

    const resolvedNsfAmount =
      nsfFeeAmount ?? policy?.nsf_fee_amount ?? null

    if (shouldCreateNsf && resolvedNsfAmount && resolvedNsfAmount > 0) {
      const glSettings = await fetchGlSettings(client, orgId)
      const { rows: existingNsfCharge } = await client.query(
        `SELECT id FROM public.charges WHERE org_id = $1 AND external_id = $2 LIMIT 1`,
        [orgId, externalId ? `nsf:${externalId}` : `nsf:${paymentTransactionId}`]
      )
      if (existingNsfCharge.length) {
        nsfChargeId = existingNsfCharge[0].id
      } else {
        const nsfIdem = externalId ? `nsf:${externalId}` : `nsf:${paymentTransactionId}`
        const creditAccount =
          nsfFeeGlAccountId ?? policy?.nsf_fee_gl_account_id ?? glSettings.late_fee_income ?? glSettings.rent_income
        const lines = [
          {
            gl_account_id: glSettings.ar_lease,
            amount: resolvedNsfAmount,
            posting_type: 'Debit' as const,
            memo: memo ?? 'NSF fee',
            property_id: payment.property_id ?? null,
            unit_id: payment.unit_id ?? null,
            lease_id: payment.lease_id ?? null,
          },
          {
            gl_account_id: creditAccount,
            amount: resolvedNsfAmount,
            posting_type: 'Credit' as const,
            memo: memo ?? 'NSF fee',
            property_id: payment.property_id ?? null,
            unit_id: payment.unit_id ?? null,
            lease_id: payment.lease_id ?? null,
          },
        ]
        const headerAmount = computeHeaderAmount(lines)
        const { rows: nsfRows } = await client.query(
          `select public.post_transaction($1::jsonb, $2::jsonb, $3::text, true) as id`,
          [
            {
              org_id: orgId,
              transaction_type: 'Charge',
              date: reversalDate,
              memo: memo ?? 'NSF fee',
              lease_id: payment.lease_id ?? null,
              property_id: payment.property_id ?? null,
              unit_id: payment.unit_id ?? null,
              total_amount: headerAmount,
              idempotency_key: nsfIdem,
              metadata: {
                reversal_of_payment_id: paymentTransactionId,
                nsf_fee: true,
                payment_id: paymentTransactionId,
              },
            },
            lines,
            nsfIdem,
          ]
        )
        const nsfTxId = nsfRows[0]?.id as string | undefined
        if (!nsfTxId) throw new Error('Failed to create NSF fee transaction')
        const { chargeRow } = await insertNsfChargeRecords({
          client,
          orgId,
          leaseId: payment.lease_id ?? null,
          amount: resolvedNsfAmount,
          transactionId: nsfTxId,
          dueDate: reversalDate,
          externalId: nsfIdem,
          memo: memo ?? 'NSF fee',
        })
        nsfChargeId = chargeRow.id
      }
    }

    return { reversalTransactionId: reversalId, nsfChargeId, updatedCharges }
  })
}
