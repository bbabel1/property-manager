import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { requireRole } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/db'
import type { DepositStatus } from '@/types/deposits'
import { DEPOSIT_STATUSES } from '@/types/deposits'
import { getDepositSummary, updateDepositStatusByIdentifier } from '@/lib/deposit-service'

const StatusSchema = z.object({ status: z.enum(DEPOSIT_STATUSES as [DepositStatus, ...DepositStatus[]]) })

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('platform_admin')
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 })
  }

  const { id } = await params
  const result = await getDepositSummary(id, supabaseAdmin)
  if (!result.ok || !result.summary) {
    return NextResponse.json({ error: result.error ?? 'Deposit not found' }, { status: 404 })
  }

  return NextResponse.json({ data: result.summary })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('platform_admin')
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = StatusSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0]
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: issue?.message ?? 'Invalid status payload' } },
      { status: 400 },
    )
  }

  const result = await updateDepositStatusByIdentifier(id, parsed.data.status, supabaseAdmin)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 })
  }

  return NextResponse.json({ data: { status: parsed.data.status } })
}
