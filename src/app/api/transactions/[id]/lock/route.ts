import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const { user } = await requireAuth()
    const body = await request.json().catch(() => ({}))
    const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason : 'locked'
    const { error } = await supabaseAdmin.rpc('lock_transaction', {
      p_transaction_id: resolvedParams.id,
      p_reason: reason,
      p_user_id: user?.id ?? null,
    })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ locked: true, transactionId: resolvedParams.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    const status = message === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
