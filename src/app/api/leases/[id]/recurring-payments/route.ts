
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { RentCycleEnumDb } from '@/schemas/lease-api'
import type { Database } from '@/types/database'
import { getServerSupabaseClient } from '@/lib/supabase-client'

const RecurringPaymentPayloadSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  payment_method: z.string().min(1, 'Payment method is required'),
  resident_id: z.string().nullable().optional(),
  memo: z.string().nullable().optional(),
  frequency: RentCycleEnumDb,
  next_date: z.string().min(1, 'Next date required'),
  posting_days_in_advance: z.number().int(),
  duration: z.enum(['until_end', 'occurrences']),
  occurrences: z.number().int().nullable().optional(),
  allocations: z.array(
    z.object({
      account_id: z.string().min(1),
      amount: z.number().nonnegative(),
    })
  ).min(1),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const leaseIdRaw = (await params).id
  const leaseId = Number(leaseIdRaw)
  if (Number.isNaN(leaseId)) {
    return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 })
  }

  const json = await request.json().catch(() => undefined)
  const parsed = RecurringPaymentPayloadSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0]
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 })
  }

  const payload = parsed.data
  const supabase = getServerSupabaseClient('recurring-payments:create')

  const insertPayload: Database['public']['Tables']['recurring_transactions']['Insert'] = {
    lease_id: leaseId,
    amount: payload.amount,
    memo: payload.memo ?? null,
    frequency: payload.frequency,
    start_date: payload.next_date,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert(insertPayload)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to create recurring payment' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
