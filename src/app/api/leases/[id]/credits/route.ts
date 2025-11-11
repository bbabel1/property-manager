import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/guards'
import { hasSupabaseAdmin } from '@/lib/supabase-client'
import type { BuildiumLeaseTransactionCreate } from '@/types/buildium'
import { LeaseTransactionService } from '@/lib/lease-transaction-service'
import {
  buildLinesFromAllocations,
  fetchBuildiumGlAccountMap,
  fetchLeaseContextById,
  fetchTransactionWithLines,
  amountsRoughlyEqual
} from '@/lib/lease-transaction-helpers'

const IssueCreditSchema = z.object({
  date: z.string().min(1),
  amount: z.number().positive(),
  memo: z.string().nullable().optional(),
  action: z.enum(['waive_charges', 'exchange', 'refund']),
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

  const json = await request.json().catch(() => undefined)
  const parsed = IssueCreditSchema.safeParse(json)
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
      return NextResponse.json({ error: 'Allocated amounts must equal the credit amount' }, { status: 400 })
    }

    const leaseContext = await fetchLeaseContextById(leaseId)
    const glAccountMap = await fetchBuildiumGlAccountMap(
      parsed.data.allocations.map((line) => line.account_id)
    )
    const lines = buildLinesFromAllocations(parsed.data.allocations, glAccountMap)

    const payload: BuildiumLeaseTransactionCreate = {
      TransactionType: 'Credit',
      TransactionDate: parsed.data.date,
      Amount: totalAmount,
      Memo: parsed.data.memo ?? parsed.data.action,
      Lines: lines,
    }

    const result = await LeaseTransactionService.createInBuildiumAndDB(
      leaseContext.buildiumLeaseId,
      payload
    )

    let normalized: any = null
    let responseLines: any[] = []
    if (result.localId) {
      const record = await fetchTransactionWithLines(result.localId)
      if (record) {
        normalized = record.transaction
        responseLines = record.lines ?? []
      }
    }

    if (!normalized) {
      normalized = {
        id: result.localId ?? result.buildium?.Id ?? null,
        transaction_type: result.buildium?.TransactionTypeEnum || result.buildium?.TransactionType || 'Credit',
        total_amount: result.buildium?.TotalAmount ?? result.buildium?.Amount ?? totalAmount,
        date: result.buildium?.Date ?? result.buildium?.TransactionDate ?? parsed.data.date,
        memo: result.buildium?.Memo ?? parsed.data.memo ?? parsed.data.action ?? null,
        lease_id: leaseContext.leaseId,
        buildium_transaction_id: result.buildium?.Id ?? null,
      }
      responseLines = lines
    }

    return NextResponse.json({ data: { transaction: normalized, lines: responseLines } }, { status: 201 })
  } catch (error) {
    console.error('Error issuing credit:', error)
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
    return NextResponse.json({ error: 'Failed to issue credit' }, { status: 500 })
  }
}
