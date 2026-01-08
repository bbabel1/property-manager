import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/guards'
import { hasSupabaseAdmin } from '@/lib/supabase-client'
import { arService } from '@/lib/ar-service'
import { CHARGE_TYPES, type ChargeType } from '@/types/ar'
import { amountsRoughlyEqual } from '@/lib/lease-transaction-helpers'

const EnterChargeSchema = z.object({
  date: z.string().min(1),
  amount: z.number().positive(),
  memo: z.string().nullable().optional(),
  allocations: z.array(z.object({ account_id: z.string().min(1), amount: z.number().nonnegative() })),
  charge_type: z.enum(CHARGE_TYPES).default('rent'),
  source: z.string().nullable().optional(),
  external_id: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
  is_prorated: z.boolean().optional(),
  proration_days: z.number().int().nullable().optional(),
  base_amount: z.number().nullable().optional(),
  parent_charge_id: z.string().nullable().optional(),
  transaction_date: z.string().nullable().optional(),
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

    const chargeType = (parsed.data.charge_type ?? 'rent') as ChargeType
    const result = await arService.createChargeWithReceivable({
      leaseId,
      chargeType,
      amount: parsed.data.amount,
      dueDate: parsed.data.date,
      description: parsed.data.memo ?? null,
      memo: parsed.data.memo ?? null,
      allocations: parsed.data.allocations.map((line) => ({
        accountId: line.account_id,
        amount: line.amount,
      })),
      source: parsed.data.source ?? 'manual',
      externalId: parsed.data.external_id ?? undefined,
      createdBy: parsed.data.created_by ?? null,
      isProrated: parsed.data.is_prorated ?? false,
      prorationDays: parsed.data.proration_days ?? null,
      baseAmount: parsed.data.base_amount ?? null,
      parentChargeId: parsed.data.parent_charge_id ?? null,
      transactionDate: parsed.data.transaction_date ?? parsed.data.date,
    })

    const transactionPayload = result.transaction ?? {
      id: result.charge.transactionId ?? null,
      transaction_type: 'Charge',
      total_amount: parsed.data.amount,
      date: parsed.data.date,
      memo: parsed.data.memo ?? null,
      lease_id: leaseId,
    }

    return NextResponse.json(
      {
        data: {
          transaction: transactionPayload,
          charge: result.charge,
          receivable: result.receivable,
        },
      },
      { status: 201 }
    )
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
