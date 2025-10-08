import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSupabaseClient } from '@/lib/supabase-client'

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

  const json = await request.json().catch(() => undefined)
  const parsed = EnterChargeSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0]
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 })
  }

  const supabase = getServerSupabaseClient('charges:create')
  const now = new Date().toISOString()
  const totalAmount = parsed.data.allocations.reduce((sum, line) => sum + (line?.amount ?? 0), 0)

  if (Number(parsed.data.amount.toFixed(2)) !== Number(totalAmount.toFixed(2))) {
    return NextResponse.json({ error: 'Allocated amounts must equal the charge amount' }, { status: 400 })
  }

  // Load lease to enrich with org + Buildium context
  const { data: leaseRow } = await supabase
    .from('lease')
    .select('id, org_id, property_id, unit_id, buildium_lease_id, buildium_property_id, buildium_unit_id')
    .eq('id', leaseId)
    .maybeSingle()

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      date: parsed.data.date,
      transaction_type: 'Charge',
      total_amount: totalAmount,
      memo: parsed.data.memo ?? null,
      lease_id: leaseId,
      org_id: leaseRow?.org_id ?? null,
      buildium_lease_id: leaseRow?.buildium_lease_id ?? null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .maybeSingle()

  if (txError || !transaction) {
    return NextResponse.json({ error: txError?.message || 'Failed to record charge' }, { status: 500 })
  }

  const linePayloads = parsed.data.allocations
    .filter((line) => Boolean(line.account_id))
    .map((line) => ({
      transaction_id: transaction.id,
      gl_account_id: line.account_id,
      amount: line.amount,
      posting_type: 'Debit',
      account_entity_type: 'Rental' as any,
      account_entity_id: leaseRow?.buildium_property_id ?? null,
      date: parsed.data.date,
      lease_id: leaseId,
      property_id: leaseRow?.property_id ?? null,
      unit_id: leaseRow?.unit_id ?? null,
      buildium_unit_id: leaseRow?.buildium_unit_id ?? null,
      buildium_lease_id: leaseRow?.buildium_lease_id ?? null,
      created_at: now,
      updated_at: now,
    }))

  let lines: any[] = []
  if (linePayloads.length) {
    const { data: insertedLines, error: lineError } = await supabase
      .from('transaction_lines')
      .insert(linePayloads)
      .select()
    if (lineError) {
      return NextResponse.json({ error: lineError.message || 'Failed to record charge lines' }, { status: 500 })
    }
    lines = insertedLines ?? []
  }

  return NextResponse.json({ data: { transaction, lines } }, { status: 201 })
}
