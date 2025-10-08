import { NextResponse } from 'next/server'
import { z } from 'zod'
import { RentCycleEnumDb } from '@/schemas/lease-api'
import { getServerSupabaseClient } from '@/lib/supabase-client'

const RecurringChargePayloadSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  gl_account_id: z.string().min(1, 'Account required'),
  memo: z.string().optional(),
  frequency: RentCycleEnumDb,
  next_date: z.string().min(1, 'Next date required'),
  posting_days_in_advance: z.number().int(),
  duration: z.enum(['until_end', 'occurrences']),
  occurrences: z.number().int().nonnegative().optional(),
})

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const leaseIdRaw = params.id
  const leaseId = Number(leaseIdRaw)
  if (Number.isNaN(leaseId)) {
    return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 })
  }

  const json = await request.json().catch(() => undefined)
  const parsed = RecurringChargePayloadSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0]
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 })
  }

  const payload = parsed.data
  const supabase = getServerSupabaseClient('recurring-charges:create')

  const insertPayload: Record<string, unknown> = {
    lease_id: leaseId,
    amount: payload.amount,
    gl_account_id: payload.gl_account_id,
    memo: payload.memo ?? null,
    frequency: payload.frequency,
    start_date: payload.next_date,
    posting_days_in_advance: payload.posting_days_in_advance,
    posting_type: 'days_in_advance',
    type: 'charge',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  insertPayload.duration = payload.duration === 'occurrences' ? 'occurrences' : 'until_end'
  insertPayload.occurrences = payload.duration === 'occurrences' ? payload.occurrences ?? 0 : null

  const { data, error } = await supabase
    .from('recurring_transactions')
    .insert(insertPayload)
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to create recurring charge' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
