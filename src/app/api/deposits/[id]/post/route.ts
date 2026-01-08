import { NextResponse, type NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/db'
import { updateDepositStatusByIdentifier } from '@/lib/deposit-service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('platform_admin')
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 403 })
  }

  const { id } = await params

  const result = await updateDepositStatusByIdentifier(id, 'posted', supabaseAdmin)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ data: { status: 'posted', transactionId: id } })
}
