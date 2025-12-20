import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/guards'
import { hasSupabaseAdmin } from '@/lib/supabase-client'
import { supabaseAdmin } from '@/lib/db'
import { PAYMENT_METHOD_VALUES } from '@/lib/enums/payment-method'
import type { BuildiumLeaseTransactionCreate } from '@/types/buildium'
import { LeaseTransactionService } from '@/lib/lease-transaction-service'
import {
  buildLinesFromAllocations,
  fetchBuildiumGlAccountMap,
  fetchLeaseContextById,
  fetchTransactionWithLines,
  mapPaymentMethodToBuildium,
  coerceTenantIdentifier,
  amountsRoughlyEqual,
  fetchBankAccountBuildiumId
} from '@/lib/lease-transaction-helpers'

const ReceivePaymentSchema = z.object({
  date: z.string().min(1),
  amount: z.number().positive(),
  payment_method: z.enum(PAYMENT_METHOD_VALUES),
  resident_id: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  allocations: z.array(z.object({ account_id: z.string().min(1), amount: z.number().nonnegative() })),
  send_email: z.boolean().optional(),
  print_receipt: z.boolean().optional(),
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

  const payload = await request.json().catch(() => undefined)
  const parsed = ReceivePaymentSchema.safeParse(payload)
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0]
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 })
  }

  try {
    if (!hasSupabaseAdmin()) {
      await requireAuth()
    }

    const totalAllocated = parsed.data.allocations.reduce((sum, line) => sum + line.amount, 0)
    if (!amountsRoughlyEqual(totalAllocated, parsed.data.amount)) {
      return NextResponse.json({ error: 'Allocated amounts must equal the payment amount' }, { status: 400 })
    }

    const allocationAccountIds = parsed.data.allocations.map((line) => line.account_id)
    const { data: allocationAccounts, error: allocationAccountsError } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, name, type')
      .in('id', allocationAccountIds)
    if (allocationAccountsError) {
      throw new Error(`Failed to load allocation accounts: ${allocationAccountsError.message}`)
    }

    const leaseContext = await fetchLeaseContextById(leaseId)

    // Resolve Buildium bank account for the property's operating bank GL (so cash hits the correct bank)
    const resolveBankAccountId = async () => {
      const propertyId = leaseContext.propertyId
      const buildiumPropertyId = leaseContext.buildiumPropertyId

      if (!propertyId && !buildiumPropertyId) return null

      const { data: propertyRow } = await supabaseAdmin
        .from('properties')
        .select('operating_bank_gl_account_id')
        .or(
          [
            propertyId ? `id.eq.${propertyId}` : null,
            buildiumPropertyId ? `buildium_property_id.eq.${buildiumPropertyId}` : null,
          ]
            .filter(Boolean)
            .join(','),
        )
        .limit(1)
        .maybeSingle()

      const operatingBankGlAccountId =
        (propertyRow as any)?.operating_bank_gl_account_id ?? null
      if (!operatingBankGlAccountId) return null

      return fetchBankAccountBuildiumId(operatingBankGlAccountId, supabaseAdmin).catch(() => null)
    }

    const glAccountMap = await fetchBuildiumGlAccountMap(
      parsed.data.allocations.map((line) => line.account_id)
    )
    const lines = buildLinesFromAllocations(parsed.data.allocations, glAccountMap)
    const payeeTenantId = coerceTenantIdentifier(parsed.data.resident_id ?? null)
    const residentProvided =
      typeof parsed.data.resident_id === 'string' && parsed.data.resident_id.trim().length > 0
    if (residentProvided && payeeTenantId == null) {
      return NextResponse.json(
        { error: 'Selected tenant is missing a Buildium tenant ID. Update the tenant record before recording a payment.' },
        { status: 422 }
      )
    }

    const buildiumBankAccountId = await resolveBankAccountId()

    const buildiumPayload: BuildiumLeaseTransactionCreate = {
      TransactionType: 'Payment',
      TransactionDate: parsed.data.date,
      Amount: parsed.data.amount,
      Memo: parsed.data.memo ?? undefined,
      PaymentMethod: mapPaymentMethodToBuildium(parsed.data.payment_method),
      PayeeTenantId: payeeTenantId,
      SendEmailReceipt: Boolean(parsed.data.send_email),
      PrintReceipt: Boolean(parsed.data.print_receipt),
      Lines: lines,
    }

    if (buildiumBankAccountId != null) {
      buildiumPayload.BankAccountId = buildiumBankAccountId
    }

    const result = await LeaseTransactionService.createInBuildiumAndDB(
      leaseContext.buildiumLeaseId,
      buildiumPayload
    )

    let normalized: any = null
    let responseLines: any[] = []
    const memoValue = parsed.data.memo ?? null
    if (result.localId) {
      const record = await fetchTransactionWithLines(result.localId)
      if (record) {
        normalized = { ...record.transaction, memo: memoValue }
        responseLines = record.lines ?? []
      }
    }

    if (!normalized) {
      normalized = {
        id: result.localId ?? result.buildium?.Id ?? null,
        transaction_type: result.buildium?.TransactionTypeEnum || result.buildium?.TransactionType || 'Payment',
        total_amount: result.buildium?.TotalAmount ?? result.buildium?.Amount ?? parsed.data.amount,
        date: result.buildium?.Date ?? result.buildium?.TransactionDate ?? parsed.data.date,
        memo: memoValue,
        lease_id: leaseContext.leaseId,
        buildium_transaction_id: result.buildium?.Id ?? null,
      }
      responseLines = lines
    }

    return NextResponse.json({ data: { transaction: normalized, lines: responseLines } }, { status: 201 })
  } catch (error) {
    console.error('Error creating lease payment:', error)
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
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
}
