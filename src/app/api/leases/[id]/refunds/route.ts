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
  fetchBankAccountBuildiumId,
  fetchTransactionWithLines,
  mapRefundMethodToBuildium,
  coerceTenantIdentifier,
  amountsRoughlyEqual
} from '@/lib/lease-transaction-helpers'

const IssueRefundSchema = z
  .object({
    date: z.string().min(1),
    bank_gl_account_id: z.string().min(1).optional(),
    // Backwards-compatibility: accept old key name but treat as gl_accounts.id
    bank_account_id: z.string().min(1).optional(),
    payment_method: z.enum(['check', 'eft']),
    party_id: z.string().nullable().optional(),
    amount: z.number().positive(),
    check_number: z.string().nullable().optional(),
    memo: z.string().nullable().optional(),
    queue_print: z.boolean().optional(),
    address_option: z.enum(['current', 'tenant', 'forwarding', 'custom']),
    custom_address: z.string().nullable().optional(),
    allocations: z.array(z.object({ account_id: z.string().min(1), amount: z.number().nonnegative() })),
  })
  .refine(
    (data) => Boolean(data.bank_gl_account_id || data.bank_account_id),
    { message: 'Bank account required', path: ['bank_gl_account_id'] },
  )

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
  const parsed = IssueRefundSchema.safeParse(json)
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
      return NextResponse.json({ error: 'Allocated amounts must equal the refund amount' }, { status: 400 })
    }

    const leaseContext = await fetchLeaseContextById(leaseId)
    const glAccountMap = await fetchBuildiumGlAccountMap(
      parsed.data.allocations.map((line) => line.account_id)
    )
    const lines = buildLinesFromAllocations(parsed.data.allocations, glAccountMap)
    const payeeTenantId = coerceTenantIdentifier(parsed.data.party_id ?? null)
    const partyProvided =
      typeof parsed.data.party_id === 'string' && parsed.data.party_id.trim().length > 0
    if (partyProvided && payeeTenantId == null) {
      return NextResponse.json(
        { error: 'Selected tenant is missing a Buildium tenant ID. Update the tenant record before issuing a refund.' },
        { status: 422 }
      )
    }
    const bankGlAccountId = parsed.data.bank_gl_account_id ?? parsed.data.bank_account_id
    const bankAccountBuildiumId = await fetchBankAccountBuildiumId(bankGlAccountId!)

    const addressOptionMap: Record<'current' | 'tenant' | 'forwarding' | 'custom', 'Current' | 'Tenant' | 'Forwarding' | 'Custom'> = {
      current: 'Current',
      tenant: 'Tenant',
      forwarding: 'Forwarding',
      custom: 'Custom',
    }

    const payload: BuildiumLeaseTransactionCreate = {
      TransactionType: 'Refund',
      TransactionDate: parsed.data.date,
      Amount: totalAmount,
      Memo: parsed.data.memo ?? undefined,
      PaymentMethod: mapRefundMethodToBuildium(parsed.data.payment_method),
      PayeeTenantId: payeeTenantId,
      BankAccountId: bankAccountBuildiumId,
      CheckNumber: parsed.data.check_number || undefined,
      QueueForPrinting: Boolean(parsed.data.queue_print),
      AddressOption: addressOptionMap[parsed.data.address_option],
      CustomAddress:
        parsed.data.address_option === 'custom' ? parsed.data.custom_address ?? undefined : undefined,
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
        transaction_type: result.buildium?.TransactionTypeEnum || result.buildium?.TransactionType || 'Refund',
        total_amount: result.buildium?.TotalAmount ?? result.buildium?.Amount ?? totalAmount,
        date: result.buildium?.Date ?? result.buildium?.TransactionDate ?? parsed.data.date,
        memo: result.buildium?.Memo ?? parsed.data.memo ?? null,
        lease_id: leaseContext.leaseId,
        buildium_transaction_id: result.buildium?.Id ?? null,
      }
      responseLines = lines
    }

    return NextResponse.json({ data: { transaction: normalized, lines: responseLines } }, { status: 201 })
  } catch (error) {
    console.error('Error issuing refund:', error)
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (
        error.message === 'Lease not found' ||
        error.message === 'Lease is missing Buildium identifier' ||
        error.message === 'Bank account not found' ||
        error.message === 'Bank account is missing a Buildium mapping' ||
        error.message.includes('Buildium mapping')
      ) {
        return NextResponse.json({ error: error.message }, { status: 422 })
      }
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'Failed to issue refund' }, { status: 500 })
  }
}
