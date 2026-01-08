import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/db'
import { createReversal } from '@/lib/accounting/reversals'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    await requireAuth()
    const body = await request.json().catch(() => ({}))
    const reversalDate =
      typeof body?.reversalDate === 'string' && body.reversalDate
        ? body.reversalDate
        : new Date().toISOString().slice(0, 10)
    const memo = typeof body?.memo === 'string' ? body.memo : undefined

    const { data: txn, error } = await supabaseAdmin
      .from('transactions')
      .select('org_id')
      .eq('id', resolvedParams.id)
      .maybeSingle()
    if (error) throw error
    if (!txn?.org_id) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })

    const { reversalTransactionId } = await createReversal({
      originalTransactionId: resolvedParams.id,
      reversalDate,
      memo,
      orgId: txn.org_id,
    })

    return NextResponse.json({ reversalTransactionId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    const status = message === 'UNAUTHENTICATED' ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
