
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { RentCycleEnumDb } from '@/schemas/lease-api'
import type { Database } from '@/types/database'
import { requireAuth } from '@/lib/auth/guards'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { requireOrgMember } from '@/lib/auth/org-guards'

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const leaseIdRaw = (await params).id
  const leaseId = Number(leaseIdRaw)
  if (Number.isNaN(leaseId)) {
    return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 })
  }

  try {
    const json = await request.json().catch(() => undefined)
    const parsed = RecurringChargePayloadSchema.safeParse(json)
    if (!parsed.success) {
      const issue = parsed.error.issues?.[0]
      return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 })
    }

    const { supabase, user } = await requireAuth()
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase)
    await requireOrgMember({ client: supabase, userId: user.id, orgId })

    const { data: lease } = await supabase
      .from('lease')
      .select('id, org_id')
      .eq('id', leaseId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (!lease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 })

    const payload = parsed.data

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
      return NextResponse.json({ error: error.message || 'Failed to create recurring charge' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      if (error.message === 'ORG_CONTEXT_REQUIRED') return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      if (error.message === 'ORG_FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to create recurring charge' }, { status: 500 })
  }
}
