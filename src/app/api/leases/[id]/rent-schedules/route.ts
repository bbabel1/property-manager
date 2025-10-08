import { NextResponse } from 'next/server'
import { z } from 'zod'
import { RentCycleEnumDb, RentScheduleStatusEnumDb } from '@/schemas/lease-api'
import { getServerSupabaseClient } from '@/lib/supabase-client'

const RentSchedulePayloadSchema = z.object({
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().nullable().optional(),
  rent_cycle: RentCycleEnumDb,
  total_amount: z.coerce.number().positive('Amount must be greater than 0'),
  status: RentScheduleStatusEnumDb.default('Future'),
  backdate_charges: z.boolean().optional().default(false),
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const leaseIdRaw = params.id
  const leaseIdNumber = Number(leaseIdRaw)

  if (!leaseIdRaw) {
    return NextResponse.json({ error: 'Lease ID is required' }, { status: 400 })
  }

  if (Number.isNaN(leaseIdNumber)) {
    return NextResponse.json({ error: 'Lease ID must be a number' }, { status: 400 })
  }

  const body = await request.json().catch(() => undefined)
  const result = RentSchedulePayloadSchema.safeParse(body)

  if (!result.success) {
    const message = result.error.issues?.[0]?.message ?? 'Invalid rent schedule payload'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const payload = result.data
  const supabase = getServerSupabaseClient('rent-schedules:create')
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('rent_schedules')
    .insert({
      lease_id: leaseIdNumber,
      start_date: payload.start_date,
      end_date: payload.end_date ?? null,
      rent_cycle: payload.rent_cycle,
      total_amount: payload.total_amount,
      status: payload.status,
      backdate_charges: payload.backdate_charges ?? false,
      created_at: now,
      updated_at: now,
    })
    .select()
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to create rent schedule' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
