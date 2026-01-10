import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildiumFetch } from '@/lib/buildium-http'
import { requireSupabaseAdmin } from '@/lib/supabase-client'
import { mapTransactionBillToBuildium } from '@/lib/buildium-mappers'
import type { BuildiumBillExtended } from '@/types/buildium'

// POST /api/buildium/bills/sync/to-buildium
// Body: { localId: string }
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    await requireRole('platform_admin')

    const body = await request.json().catch(() => ({}))
    const localId = body?.localId as string
    if (!localId) {
      return NextResponse.json({ error: 'localId is required' }, { status: 400 })
    }

    const supabaseAdmin = requireSupabaseAdmin('sync bill to Buildium')

    // Load local transaction
    const { data: tx, error: txErr } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', localId)
      .single()
    if (txErr || !tx) {
      return NextResponse.json({ error: 'Local transaction not found', details: txErr }, { status: 404 })
    }
    if (tx.transaction_type !== 'Bill') {
      return NextResponse.json({ error: 'Transaction is not a Bill' }, { status: 400 })
    }

    // Map to Buildium payload
    const payload = await mapTransactionBillToBuildium(localId, supabaseAdmin)

    // Create or Update
    const isUpdate = typeof tx.buildium_bill_id === 'number' && tx.buildium_bill_id > 0
    const path = isUpdate ? `/bills/${tx.buildium_bill_id}` : '/bills'

    const response = await buildiumFetch(isUpdate ? 'PUT' : 'POST', path, undefined, payload, undefined)

    if (!response.ok) {
      const errorData = response.json ?? {}
      logger.error('Push bill to Buildium failed')
      return NextResponse.json({ error: 'Failed to sync bill to Buildium', details: errorData }, { status: response.status })
    }

    const buildiumBill = (response.json ?? {}) as Partial<BuildiumBillExtended>
    const newBuildiumId = buildiumBill?.Id as number | undefined
    if (newBuildiumId && !isUpdate) {
      // Update local transaction with newly assigned Buildium Bill Id
      await supabaseAdmin
        .from('transactions')
        .update({ buildium_bill_id: newBuildiumId, updated_at: new Date().toISOString() })
        .eq('id', localId)
    }

    return NextResponse.json({ success: true, buildiumId: newBuildiumId ?? tx.buildium_bill_id, payload })
  } catch (error) {
    logger.error({ error }, 'Error syncing local bill to Buildium')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
