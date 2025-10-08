import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSupabaseClient } from '@/lib/supabase-client'
import { PAYMENT_METHOD_VALUES } from '@/lib/enums/payment-method'

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

  const supabase = getServerSupabaseClient('payments:create')

  const now = new Date().toISOString()
  const tenantIdNumber = parsed.data.resident_id ? Number(parsed.data.resident_id) : null
  const payeeTenantId = Number.isFinite(tenantIdNumber) ? tenantIdNumber : null

  // Load lease for org + Buildium context
  const { data: leaseRow } = await supabase
    .from('lease')
    .select('id, org_id, property_id, unit_id, buildium_lease_id, buildium_property_id, buildium_unit_id')
    .eq('id', leaseId)
    .maybeSingle()

  const transactionInsert = {
    date: parsed.data.date,
    transaction_type: 'Payment',
    total_amount: parsed.data.amount,
    payment_method: parsed.data.payment_method as any,
    memo: parsed.data.memo ?? null,
    lease_id: leaseId,
    org_id: leaseRow?.org_id ?? null,
    buildium_lease_id: leaseRow?.buildium_lease_id ?? null,
    payee_tenant_id: payeeTenantId,
    email_receipt: Boolean(parsed.data.send_email),
    print_receipt: Boolean(parsed.data.print_receipt),
    created_at: now,
    updated_at: now,
  }

  const { data: transaction, error: transactionError } = await supabase
    .from('transactions')
    .insert(transactionInsert as any)
    .select()
    .maybeSingle()

  if (transactionError || !transaction) {
    return NextResponse.json({ error: transactionError?.message || 'Failed to record payment' }, { status: 500 })
  }

  const linePayloads = parsed.data.allocations
    .filter((line) => Boolean(line.account_id))
    .map((line) => ({
      transaction_id: transaction.id,
      gl_account_id: line.account_id,
      amount: line.amount,
      posting_type: 'Credit',
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

  let lines = [] as any[]
  if (linePayloads.length) {
    const { data: insertedLines, error: lineError } = await supabase
      .from('transaction_lines')
      .insert(linePayloads)
      .select()
    if (lineError) {
      return NextResponse.json({ error: lineError.message || 'Failed to record payment lines' }, { status: 500 })
    }
    lines = insertedLines ?? []
  }

  return NextResponse.json({ data: { transaction, lines } }, { status: 201 })
}
