import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/guards'
import { hasSupabaseAdmin } from '@/lib/supabase-client'
import type { BuildiumLeaseTransactionCreate } from '@/types/buildium'
import type { Database as DatabaseSchema } from '@/types/database'
import { LeaseTransactionService } from '@/lib/lease-transaction-service'
import {
  buildLinesFromAllocations,
  fetchBuildiumGlAccountMap,
  fetchLeaseContextById,
  fetchTransactionWithLines,
  amountsRoughlyEqual
} from '@/lib/lease-transaction-helpers'
import { supabaseAdmin } from '@/lib/db'

type TransactionLineWithAccount = Pick<
  DatabaseSchema['public']['Tables']['transaction_lines']['Row'],
  'id' | 'amount' | 'posting_type' | 'gl_account_id' | 'property_id' | 'unit_id' | 'memo'
> & {
  gl_accounts: Pick<DatabaseSchema['public']['Tables']['gl_accounts']['Row'], 'name' | 'sub_type' | 'type'> | null
}

type TransactionLease = Pick<
  DatabaseSchema['public']['Tables']['lease']['Row'],
  'id' | 'property_id' | 'unit_id' | 'org_id'
> | null

type TransactionWithLines = Pick<
  DatabaseSchema['public']['Tables']['transactions']['Row'],
  'id' | 'date' | 'memo' | 'transaction_type'
> & {
  lease: TransactionLease
  transaction_lines: TransactionLineWithAccount[]
}

const EnterChargeSchema = z.object({
  date: z.string().min(1),
  amount: z.number().positive(),
  memo: z.string().nullable().optional(),
  allocations: z.array(z.object({ account_id: z.string().min(1), amount: z.number().nonnegative() })),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const leaseId = Number(id)
  if (Number.isNaN(leaseId)) {
    return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 })
  }

  const db = supabaseAdmin
  const ensureAccountsReceivableLine = async (transactionId: string | null) => {
    if (!db || !transactionId) return

    const { data: txRows, error: txErr } = await db
      .from('transactions')
      .select(
        `
        id,
        date,
        memo,
        transaction_type,
        lease:lease (id, property_id, unit_id, org_id),
        transaction_lines (
          id,
          amount,
          posting_type,
          gl_account_id,
          property_id,
          unit_id,
          memo,
          gl_accounts (name, sub_type, type)
        )
      `,
      )
      .eq('id', transactionId)
      .limit(1)

    if (txErr || !txRows?.length) return
    const tx = (txRows[0] ?? null) as TransactionWithLines | null
    if (!tx) return
    if ((tx.transaction_type || '').toLowerCase() !== 'charge') return

    const lines = Array.isArray(tx.transaction_lines) ? tx.transaction_lines : []
    const hasAr = lines.some((line) => {
      const name = (line?.gl_accounts?.name || '').toString().toLowerCase()
      const subType = (line?.gl_accounts?.sub_type || '').toString().toLowerCase().replace(/[\s_-]+/g, '')
      const type = (line?.gl_accounts?.type || '').toString().toLowerCase()
      return type === 'asset' && (name.includes('receivable') || subType.includes('accountsreceivable'))
    })
    if (hasAr) return

    const creditSum = lines
      .filter((line) => (line?.posting_type || '').toLowerCase() === 'credit')
      .reduce((sum, line) => sum + Math.abs(Number(line?.amount) || 0), 0)
    const debitSum = lines
      .filter((line) => (line?.posting_type || '').toLowerCase() === 'debit')
      .reduce((sum, line) => sum + Math.abs(Number(line?.amount) || 0), 0)
    const arAmount = creditSum - debitSum
    if (!(arAmount > 0)) return

    const orgId = tx.lease?.org_id ?? null
    const { data: orgArRow } =
      orgId != null
        ? await db
            .from('gl_accounts')
            .select('id')
            .eq('org_id', orgId)
            .ilike('name', 'Accounts Receivable')
            .maybeSingle()
        : { data: null }
    const { data: fallbackArRow } = await db
      .from('gl_accounts')
      .select('id')
      .ilike('name', 'Accounts Receivable')
      .maybeSingle()
    const arGlId = orgArRow?.id ?? fallbackArRow?.id ?? null
    if (!arGlId) return

    const nowIso = new Date().toISOString()
    const lineDate = typeof tx.date === 'string' && tx.date ? tx.date : nowIso.slice(0, 10)
    const propertyId = tx.lease?.property_id ?? lines[0]?.property_id ?? null
    const unitId = tx.lease?.unit_id ?? lines[0]?.unit_id ?? null

    await db.from('transaction_lines').insert({
      transaction_id: transactionId,
      gl_account_id: arGlId,
      amount: arAmount,
      posting_type: 'Debit',
      memo: tx?.memo ?? null,
      date: lineDate,
      account_entity_type: 'Rental',
      account_entity_id: null,
      property_id: propertyId,
      unit_id: unitId,
      lease_id: tx.lease?.id ?? leaseId,
      created_at: nowIso,
      updated_at: nowIso,
    })
  }

  const json = await request.json().catch(() => undefined)
  const parsed = EnterChargeSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0]
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 })
  }

  try {
    if (!hasSupabaseAdmin()) {
      await requireAuth()
    }

    const totalAmount = parsed.data.allocations.reduce((sum, line) => sum + (line?.amount ?? 0), 0)
    if (!amountsRoughlyEqual(parsed.data.amount, totalAmount)) {
      return NextResponse.json({ error: 'Allocated amounts must equal the charge amount' }, { status: 400 })
    }

    const leaseContext = await fetchLeaseContextById(leaseId)
    const glAccountMap = await fetchBuildiumGlAccountMap(
      parsed.data.allocations.map((line) => line.account_id)
    )
    const lines = buildLinesFromAllocations(parsed.data.allocations, glAccountMap)

    const payload: BuildiumLeaseTransactionCreate = {
      TransactionType: 'Charge',
      TransactionDate: parsed.data.date,
      Amount: totalAmount,
      Memo: parsed.data.memo ?? undefined,
      Lines: lines,
    }

    const result = await LeaseTransactionService.createInBuildiumAndDB(
      leaseContext.buildiumLeaseId,
      payload
    )

    let normalized: Record<string, unknown> | null = null
    let responseLines: Array<Record<string, unknown>> = []
    const memoValue = parsed.data.memo ?? null

    if (result.localId) {
      const record = await fetchTransactionWithLines(result.localId)
      if (record) {
        normalized = { ...record.transaction, memo: memoValue }
        responseLines = record.lines ?? []
      }
      await ensureAccountsReceivableLine(result.localId)
      // Refresh lines in case the A/R guard inserted a debit
      const updated = await fetchTransactionWithLines(result.localId)
      if (updated?.lines) {
        responseLines = updated.lines
      }
    }

    if (!normalized) {
      normalized = {
        id: result.localId ?? result.buildium?.Id ?? null,
        transaction_type: result.buildium?.TransactionTypeEnum || result.buildium?.TransactionType || 'Charge',
        total_amount: result.buildium?.TotalAmount ?? result.buildium?.Amount ?? totalAmount,
        date: result.buildium?.Date ?? result.buildium?.TransactionDate ?? parsed.data.date,
        memo: memoValue,
        lease_id: leaseContext.leaseId,
        buildium_transaction_id: result.buildium?.Id ?? null,
      }
      responseLines = lines
    }

    return NextResponse.json({ data: { transaction: normalized, lines: responseLines } }, { status: 201 })
  } catch (error) {
    console.error('Error creating lease charge:', error)
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (
        error.message === 'Lease not found' ||
        error.message === 'Lease is missing Buildium identifier' ||
        error.message.includes('Buildium mapping')
      ) {
        return NextResponse.json({ error: error.message }, { status: 422 })
      }
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Failed to record charge' }, { status: 500 })
  }
}
