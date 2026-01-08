import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/db'
import { getDepositSummary } from '@/lib/deposit-service'

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
