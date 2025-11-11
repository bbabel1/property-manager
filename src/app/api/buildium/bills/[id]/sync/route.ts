import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { requireSupabaseAdmin } from '@/lib/supabase-client'
import { upsertBillWithLines } from '@/lib/buildium-mappers'

// POST /api/buildium/bills/[id]/sync
// Fetch a single bill from Buildium by Id and persist to DB
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    await requireUser()
    const billId = (await params).id
    if (!billId) return NextResponse.json({ error: 'Missing billId' }, { status: 400 })

    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bills/${billId}`
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    })
    if (!response.ok) {
      const details = await response.json().catch(() => ({}))
      return NextResponse.json({ error: 'Failed to fetch bill from Buildium', details }, { status: response.status })
    }

    const bill = await response.json()
    const supabaseAdmin = requireSupabaseAdmin('sync bill from Buildium')
    const { transactionId } = await upsertBillWithLines(bill, supabaseAdmin)
    return NextResponse.json({ success: true, transactionId })
  } catch (error) {
    logger.error({ error }, 'Error syncing bill by ID from Buildium')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
