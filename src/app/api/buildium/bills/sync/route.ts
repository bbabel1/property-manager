import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'

import { upsertBillWithLines } from '@/lib/buildium-mappers'

export async function GET(request: NextRequest) {
  try {
    const isCron = request.headers.get('x-cron-secret') === process.env.CRON_SECRET
    if (!isCron) {
      const rate = await checkRateLimit(request)
      if (!rate.success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      await requireUser()
    }

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '50'
    const offset = searchParams.get('offset') || '0'
    const vendorId = searchParams.get('vendorId') || undefined
    const propertyId = searchParams.get('propertyId') || undefined
    const unitId = searchParams.get('unitId') || undefined
    const status = searchParams.get('status') || undefined
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined

    const query = new URLSearchParams()
    if (limit) query.append('limit', limit)
    if (offset) query.append('offset', offset)
    if (vendorId) query.append('vendorId', vendorId)
    if (propertyId) query.append('propertyId', propertyId)
    if (unitId) query.append('unitId', unitId)
    if (status) query.append('status', status)
    if (dateFrom) query.append('dateFrom', dateFrom)
    if (dateTo) query.append('dateTo', dateTo)

    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bills?${query.toString()}`

    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    })

    if (!response.ok) {
      const details = await response.json().catch(() => ({}))
      logger.error('Buildium bills fetch failed for sync')
      return NextResponse.json({ error: 'Failed to fetch bills from Buildium', details }, { status: response.status })
    }

    const bills = await response.json()
    if (!Array.isArray(bills)) {
      return NextResponse.json({ error: 'Unexpected bills response shape' }, { status: 502 })
    }

    let success = 0
    const failures: Array<{ id?: number; error: string }> = []
    for (const bill of bills) {
      try {
        await upsertBillWithLines(bill, supabaseAdmin)
        success += 1
      } catch (e) {
        failures.push({ id: bill?.Id, error: e instanceof Error ? e.message : 'Unknown error' })
      }
    }

    logger.info({ imported: success, failed: failures.length }, 'Buildium bills synced to DB')
    return NextResponse.json({ success: true, imported: success, failed: failures.length, failures })
  } catch (error) {
    logger.error('Error syncing Buildium bills to DB')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const isCron = request.headers.get('x-cron-secret') === process.env.CRON_SECRET
    if (!isCron) {
      const rate = await checkRateLimit(request)
      if (!rate.success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      await requireUser()
    }

    // Accept a single Buildium bill payload and upsert it
    const payload = await request.json()
    const { transactionId } = await upsertBillWithLines(payload, supabaseAdmin)
    return NextResponse.json({ success: true, transactionId }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to upsert bill' }, { status: 400 })
  }
}
