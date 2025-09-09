import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'
import { mapTransactionBillToBuildium } from '@/lib/buildium-mappers'

// POST /api/buildium/bills/sync/to-buildium
// Body: { localId: string }
export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    await requireUser()

    const body = await request.json().catch(() => ({}))
    const localId = body?.localId as string
    if (!localId) {
      return NextResponse.json({ error: 'localId is required' }, { status: 400 })
    }

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
    const buildiumUrl = isUpdate
      ? `${process.env.BUILDIUM_BASE_URL}/bills/${tx.buildium_bill_id}`
      : `${process.env.BUILDIUM_BASE_URL}/bills`

    const response = await fetch(buildiumUrl, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('Push bill to Buildium failed')
      return NextResponse.json({ error: 'Failed to sync bill to Buildium', details: errorData }, { status: response.status })
    }

    const buildiumBill = await response.json()
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
    logger.error('Error syncing local bill to Buildium', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

