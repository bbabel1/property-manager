import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/guards'
import { PAYMENT_METHOD_VALUES } from '@/lib/enums/payment-method'
import type { BuildiumLeaseTransactionCreate } from '@/types/buildium'
import { LeaseTransactionService } from '@/lib/lease-transaction-service'
import { allocationEngine } from '@/lib/allocation-engine'
import {
  buildLinesFromAllocations,
  fetchBuildiumGlAccountMap,
  fetchLeaseContextById,
  fetchTransactionWithLines,
  mapPaymentMethodToBuildium,
  coerceTenantIdentifier,
  amountsRoughlyEqual,
  castLeaseTransactionLinesForPersistence
} from '@/lib/lease-transaction-helpers'
import { resolveUndepositedFundsGlAccountId } from '@/lib/buildium-mappers'
import { ensurePaymentToUndepositedFunds } from '@/lib/deposit-service'
import PayerRestrictionsService from '@/lib/payments/payer-restrictions-service'
import type { Charge, PaymentAllocation } from '@/types/ar'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { requireOrgMember } from '@/lib/auth/org-guards'

const ReceivePaymentSchema = z.object({
  date: z.string().min(1),
  amount: z.number().positive(),
  payment_method: z.enum(PAYMENT_METHOD_VALUES),
  resident_id: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  allocations: z.array(z.object({ account_id: z.string().min(1), amount: z.number().nonnegative() })),
  send_email: z.boolean().optional(),
  print_receipt: z.boolean().optional(),
  bypass_udf: z.boolean().optional(),
  charge_allocations: z
    .array(
      z.object({
        charge_id: z.string().min(1),
        amount: z.number().positive(),
      })
    )
    .optional(),
  allocation_external_id: z.string().nullable().optional(),
  idempotency_key: z.string().min(1).optional(),
})

export async function POST(
  request: NextRequest,
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
    const { supabase: db, user } = await requireAuth()
    const orgId = await resolveOrgIdFromRequest(request, user.id, db)
    await requireOrgMember({ client: db, userId: user.id, orgId })

    const totalAllocated = parsed.data.allocations.reduce((sum, line) => sum + line.amount, 0)
    if (!amountsRoughlyEqual(totalAllocated, parsed.data.amount)) {
      return NextResponse.json({ error: 'Allocated amounts must equal the payment amount' }, { status: 400 })
    }

    const allocationAccountIds = parsed.data.allocations.map((line) => line.account_id)
    const { data: _allocationAccounts, error: allocationAccountsError } = await db
      .from('gl_accounts')
      .select('id, name, type')
      .in('id', allocationAccountIds)
      .eq('org_id', orgId)
    if (allocationAccountsError) {
      throw new Error(`Failed to load allocation accounts: ${allocationAccountsError.message}`)
    }

    const leaseContext = await fetchLeaseContextById(leaseId, db)
    if (leaseContext.orgId && leaseContext.orgId !== orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const glAccountMap = await fetchBuildiumGlAccountMap(
      parsed.data.allocations.map((line) => line.account_id),
      db
    )
    const buildiumLines = buildLinesFromAllocations(parsed.data.allocations, glAccountMap)
    const lines = castLeaseTransactionLinesForPersistence(buildiumLines)
    const payeeTenantId = coerceTenantIdentifier(parsed.data.resident_id ?? null)
    const residentProvided =
      typeof parsed.data.resident_id === 'string' && parsed.data.resident_id.trim().length > 0
    if (residentProvided && payeeTenantId == null) {
      return NextResponse.json(
        { error: 'Selected tenant is missing a Buildium tenant ID. Update the tenant record before recording a payment.' },
        { status: 422 }
      )
    }

    const udfGlAccountId = await resolveUndepositedFundsGlAccountId(db, leaseContext.orgId)
    if (!udfGlAccountId) {
      return NextResponse.json(
        { error: 'Undeposited Funds account is missing for this organization.' },
        { status: 422 }
      )
    }

    // Intended bank (stored on header), but do not send to Buildium payload
    const intendedBankBuildiumId = null

    // Restriction check before calling Buildium
    if (payeeTenantId != null && leaseContext.orgId) {
      // Resolve local tenant id to align with payer_restrictions.payer_id (UUID)
      const { data: tenantRow } = await db
        .from('tenants')
        .select('id')
        .eq('buildium_tenant_id', payeeTenantId)
        .eq('org_id', leaseContext.orgId)
        .maybeSingle()
      const payerId = tenantRow?.id ?? null
      if (payerId) {
        const restricted = await PayerRestrictionsService.checkRestriction(
          leaseContext.orgId,
          payerId,
          parsed.data.payment_method
        )
        if (restricted) {
          return NextResponse.json(
            { error: 'This payer is restricted from using the selected payment method.' },
            { status: 422 }
          )
        }
      }
    }

    const shouldUseUdf = !parsed.data.bypass_udf &&
      ['ElectronicPayment', 'DirectDeposit', 'CreditCard'].includes(parsed.data.payment_method)

    const bankAccountIdForBuildium = shouldUseUdf ? undefined : intendedBankBuildiumId ?? undefined

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
      BankAccountId: bankAccountIdForBuildium,
    }

    const result = await LeaseTransactionService.createInBuildiumAndDB(
      leaseContext.buildiumLeaseId,
      buildiumPayload,
      leaseContext.orgId ?? undefined,
      { idempotencyKey: parsed.data.idempotency_key, bypassUdf: Boolean(parsed.data.bypass_udf) }
    )

    let intentState: string | null = null
    if (result.intentId) {
      const { data: intentRow } = await db
        .from('payment_intent')
        .select('state')
        .eq('org_id', orgId)
        .eq('id', result.intentId)
        .maybeSingle()
      if (!intentRow && leaseContext.orgId && leaseContext.orgId !== orgId) {
        const scoped = await db
          .from('payment_intent')
          .select('state')
          .eq('org_id', leaseContext.orgId)
          .eq('id', result.intentId)
          .maybeSingle()
        intentState = (scoped.data?.state as string | null) ?? null
      } else {
        intentState = (intentRow?.state as string | null) ?? null
      }
    }
    if (result.localId) {
      await ensurePaymentToUndepositedFunds(result.localId, leaseContext.orgId, db, {
        intendedBankBuildiumId: intendedBankBuildiumId ?? null,
      })
    }

    let normalized: Record<string, unknown> | null = null
    let responseLines: Record<string, unknown>[] = []
    let allocationsResponse: PaymentAllocation[] = []
    let updatedCharges: Charge[] = []
    const memoValue = parsed.data.memo ?? null
    if (result.localId) {
      const record = await fetchTransactionWithLines(result.localId)
      if (record) {
        normalized = { ...record.transaction, memo: memoValue }
        responseLines = (record.lines ?? []) as Record<string, unknown>[]
      }

      const hasChargeAllocations =
        Array.isArray(parsed.data.charge_allocations) && parsed.data.charge_allocations.length > 0
      const shouldAttemptAllocation = true // always try to allocate; fallback below handles GL-only payments

      try {
        if (shouldAttemptAllocation) {
          const allocationResult = await allocationEngine.allocatePayment(
            parsed.data.amount,
            leaseId,
            result.localId,
            undefined,
            parsed.data.charge_allocations?.map((alloc) => ({
              chargeId: alloc.charge_id,
              amount: alloc.amount,
            })),
            parsed.data.allocation_external_id ?? undefined
          )
          allocationsResponse = allocationResult.allocations
          updatedCharges = allocationResult.charges
        }
      } catch (allocationErr) {
        const message =
          allocationErr instanceof Error ? allocationErr.message : String(allocationErr ?? '')
        // If there are no open charges and caller did not request manual charge allocations,
        // treat this as a GL-only payment and continue. Otherwise, bubble up.
        if (
          message.includes('No outstanding charges to allocate against') &&
          !hasChargeAllocations &&
          !parsed.data.allocation_external_id
        ) {
          allocationsResponse = []
          updatedCharges = []
        } else {
          throw allocationErr
        }
      }

      // Stamp payment metadata for reconciliation
      await db
        .from('transactions')
        .update({ metadata: { payment_id: result.localId } })
        .eq('id', result.localId)
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

    return NextResponse.json(
      {
        data: {
          transaction: normalized,
        lines: responseLines,
        allocations: allocationsResponse,
        charges: updatedCharges,
        intent_id: result.intentId ?? null,
        intent_state: intentState,
      },
    },
    { status: 201 },
  )
  } catch (error) {
    console.error('Error creating lease payment:', error)
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (
        error.message.includes('allocation') ||
        error.message.includes('outstanding charges') ||
        error.message.includes('lease mismatch')
      ) {
        return NextResponse.json({ error: error.message }, { status: 422 })
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
