import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/guards'
import { hasSupabaseAdmin } from '@/lib/supabase-client'
import type { BuildiumLeaseTransactionCreate } from '@/types/buildium'
import { LeaseTransactionService } from '@/lib/lease-transaction-service'
import {
  buildDepositLines,
  fetchBuildiumGlAccountMap,
  fetchLeaseContextById,
  fetchTransactionWithLines
} from '@/lib/lease-transaction-helpers'

const WithholdDepositSchema = z.object({
  date: z.string().min(1),
  deposit_account_id: z.string().min(1),
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

  const json = await request.json().catch(() => undefined)
  const parsed = WithholdDepositSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0]
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 })
  }

  try {
    if (!hasSupabaseAdmin()) {
      await requireAuth()
    }

    const leaseContext = await fetchLeaseContextById(leaseId)
    const glAccountMap = await fetchBuildiumGlAccountMap([
      parsed.data.deposit_account_id,
      ...parsed.data.allocations.map((line) => line.account_id),
    ])
    const { lines, debitTotal, depositBuildiumAccountId } = buildDepositLines({
      allocations: parsed.data.allocations,
      depositAccountId: parsed.data.deposit_account_id,
      glAccountMap,
      memo: parsed.data.memo ?? null,
    })

    const payload: BuildiumLeaseTransactionCreate = {
      TransactionType: 'ApplyDeposit',
      TransactionDate: parsed.data.date,
      Amount: debitTotal,
      Memo: parsed.data.memo ?? undefined,
      Lines: lines,
      DepositAccountId: depositBuildiumAccountId,
    }

    const result = await LeaseTransactionService.createInBuildiumAndDB(
      leaseContext.buildiumLeaseId,
      payload
    )

    let normalized: Record<string, unknown> | null = null
    let responseLines: Record<string, unknown>[] = []
    if (result.localId) {
      const record = await fetchTransactionWithLines(result.localId)
      if (record) {
        normalized = record.transaction as Record<string, unknown>
        responseLines = (record.lines ?? []) as Record<string, unknown>[]
      }
    }

    if (!normalized) {
      normalized = {
        id: result.localId ?? result.buildium?.Id ?? null,
        transaction_type: result.buildium?.TransactionTypeEnum || result.buildium?.TransactionType || 'ApplyDeposit',
        total_amount: result.buildium?.TotalAmount ?? result.buildium?.Amount ?? debitTotal,
        date: result.buildium?.Date ?? result.buildium?.TransactionDate ?? parsed.data.date,
        memo: result.buildium?.Memo ?? parsed.data.memo ?? null,
        lease_id: leaseContext.leaseId,
        buildium_transaction_id: result.buildium?.Id ?? null,
      }
      responseLines = lines as Record<string, unknown>[]
    }

    return NextResponse.json({ data: { transaction: normalized, lines: responseLines } }, { status: 201 })
  } catch (error: unknown) {
    console.error('Error withholding deposit:', error)
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
    return NextResponse.json({ error: 'Failed to withhold deposit' }, { status: 500 })
  }
}
