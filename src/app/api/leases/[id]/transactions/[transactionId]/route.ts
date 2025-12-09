import { NextResponse } from 'next/server'
import { z } from 'zod'
import { LeaseTransactionService } from '@/lib/lease-transaction-service'
import { supabaseAdmin } from '@/lib/db'
import { getServerSupabaseClient, requireSupabaseAdmin } from '@/lib/supabase-client'

const UpdateSchema = z.object({
  transaction_type: z.enum(['Charge', 'Payment']),
  date: z.string().min(1),
  amount: z.number().nonnegative(),
  memo: z.string().nullable().optional(),
  allocations: z.array(z.object({ account_id: z.string().min(1), amount: z.number().nonnegative(), memo: z.string().optional().nullable() })),
})

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id, transactionId: txIdRaw } = await context.params
  const leaseId = Number(id)
  if (!Number.isFinite(leaseId)) {
    return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 })
  }

  const uuidLike = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  const isUuid = uuidLike.test(String(txIdRaw))
  const txNumeric = Number(txIdRaw)
  const isNumeric = Number.isFinite(txNumeric)
  if (!isUuid && !isNumeric) {
    return NextResponse.json({ error: 'Invalid transaction reference' }, { status: 400 })
  }

  try {
    let buildiumLeaseId: number | null = null
    try {
      const db = supabaseAdmin || (await getServerSupabaseClient())
      if (db) {
        const { data: leaseRow } = await (db as any)
          .from('lease')
          .select('buildium_lease_id')
          .eq('id', leaseId)
          .maybeSingle()
        const raw = leaseRow?.buildium_lease_id
        if (raw != null && !Number.isNaN(Number(raw))) {
          buildiumLeaseId = Number(raw)
        }
      }
    } catch {}

    if (supabaseAdmin) {
      const { data: localTx } = await supabaseAdmin
        .from('transactions')
        .select('id, date, total_amount, memo, transaction_type, transaction_lines ( gl_account_id, amount, memo )')
        .eq(isUuid ? 'id' : 'buildium_transaction_id', isUuid ? txIdRaw : txNumeric)
        .maybeSingle()

      if (localTx) {
        const payload = {
          Id: localTx.id,
          Date: localTx.date,
          TotalAmount: localTx.total_amount,
          Memo: localTx.memo,
          TransactionTypeEnum: localTx.transaction_type,
          Lines: (localTx.transaction_lines || []).map((line: any) => ({
            GLAccountId: line?.gl_account_id,
            Amount: line?.amount,
            Memo: line?.memo,
          })),
        }
        return NextResponse.json({ data: payload })
      }
    }

    const tx = isNumeric
      ? await LeaseTransactionService.getFromBuildium(
          buildiumLeaseId != null && Number.isFinite(buildiumLeaseId) ? buildiumLeaseId : leaseId,
          txNumeric,
          false,
        )
      : null
    if (!tx) {
      return NextResponse.json({ error: `Transaction not found for lease ${leaseId} and reference ${txIdRaw}` }, { status: 404 })
    }
    return NextResponse.json({ data: tx })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load transaction' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id, transactionId: txId } = await context.params
  const leaseId = Number(id)
  const transactionId = Number(txId)
  if (!Number.isFinite(leaseId) || !Number.isFinite(transactionId)) {
    return NextResponse.json({ error: 'Invalid identifiers' }, { status: 400 })
  }

  const json = await request.json().catch(() => undefined)
  const parsed = UpdateSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0]
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 })
  }

  if (parsed.data.transaction_type !== 'Charge') {
    return NextResponse.json({ error: 'Only charge transactions can be edited at this time' }, { status: 400 })
  }

  try {
    const lines = parsed.data.allocations
      .map((line) => ({
        GLAccountId: Number(line.account_id),
        Amount: line.amount,
        Memo: line.memo ?? undefined,
      }))
      .filter((line) => Number.isFinite(line.GLAccountId))

    if (!lines.length) {
      return NextResponse.json({ error: 'At least one allocation is required' }, { status: 400 })
    }

    const payload = {
      TransactionType: 'Charge' as const,
      TransactionDate: parsed.data.date,
      Amount: parsed.data.amount,
      Memo: parsed.data.memo ?? undefined,
      Lines: lines,
    }
    const result = await LeaseTransactionService.updateInBuildiumAndDB(leaseId, transactionId, payload)

    return NextResponse.json({ data: result.buildium })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update transaction' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id, transactionId: txIdRaw } = await context.params
  const leaseId = Number(id)
  if (!Number.isFinite(leaseId)) {
    return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 })
  }

  try {
    const db = requireSupabaseAdmin('transactions:delete')
    const raw = String(txIdRaw ?? '').trim()
    console.log('[DELETE transaction]', { leaseId, raw })
    const uuidLike = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(raw)

    let txIdLocal: string | null = null

    if (uuidLike) {
      const { data: existing } = await db
        .from('transactions')
        .select('id, lease_id')
        .eq('id', raw)
        .maybeSingle()
      console.log('[DELETE lookup uuid]', { existing })
      if (existing?.id) {
        const assignedLeaseId = typeof existing.lease_id === 'string' ? Number(existing.lease_id) : existing.lease_id
        if (!Number.isFinite(assignedLeaseId) || assignedLeaseId !== leaseId) {
          // Guard against deleting another lease's transaction
          return NextResponse.json({ error: 'Transaction does not belong to this lease' }, { status: 403 })
        }
        txIdLocal = existing.id
      }
    }

    if (!txIdLocal) {
      const n = Number(raw)
      if (Number.isFinite(n)) {
        const { data: existing } = await db
          .from('transactions')
          .select('id, lease_id')
          .eq('buildium_transaction_id', n)
          .maybeSingle()
        console.log('[DELETE lookup buildium]', { existing })
        if (existing?.id) {
          const assignedLeaseId = typeof existing.lease_id === 'string' ? Number(existing.lease_id) : existing.lease_id
          if (!Number.isFinite(assignedLeaseId) || assignedLeaseId !== leaseId) {
            return NextResponse.json({ error: 'Transaction does not belong to this lease' }, { status: 403 })
          }
          txIdLocal = existing.id
        }
      }
    }

    if (txIdLocal) {
      await db.from('transaction_lines').delete().eq('transaction_id', txIdLocal)
      await db.from('journal_entries').delete().eq('transaction_id', txIdLocal)
      const { error: delErr } = await db.from('transactions').delete().eq('id', txIdLocal)
      if (delErr) throw delErr
    }

    return NextResponse.json({ ok: true, deleted: Boolean(txIdLocal) }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete transaction' }, { status: 500 })
  }
}
