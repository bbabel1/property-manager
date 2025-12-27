import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { buildiumFetch } from '@/lib/buildium-http'
import { requireSupabaseAdmin, SupabaseAdminUnavailableError } from '@/lib/supabase-client'

import { upsertBillWithLines } from '@/lib/buildium-mappers'

export async function GET(request: NextRequest) {
  try {
    const isCron = request.headers.get('x-cron-secret') === process.env.CRON_SECRET
    if (!isCron) {
      const rate = await checkRateLimit(request)
      if (!rate.success) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }
      await requireRole('platform_admin')
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

    const queryParams: Record<string, string> = {}
    if (limit) queryParams.limit = limit
    if (offset) queryParams.offset = offset
    if (vendorId) queryParams.vendorId = vendorId
    if (propertyId) queryParams.propertyId = propertyId
    if (unitId) queryParams.unitId = unitId
    if (status) queryParams.status = status
    if (dateFrom) queryParams.dateFrom = dateFrom
    if (dateTo) queryParams.dateTo = dateTo

    const response = await buildiumFetch('GET', '/bills', queryParams, undefined, undefined)

    if (!response.ok) {
      const details = response.json ?? {}
      logger.error('Buildium bills fetch failed for sync')
      return NextResponse.json({ error: 'Failed to fetch bills from Buildium', details }, { status: response.status })
    }

    const admin = requireSupabaseAdmin('buildium bills sync GET')

    const bills = (response.json ?? []) as unknown[]
    if (!Array.isArray(bills)) {
      return NextResponse.json({ error: 'Unexpected bills response shape' }, { status: 502 })
    }

    let success = 0
    const failures: Array<{ id?: number; error: string }> = []
    for (const bill of bills) {
      try {
        await upsertBillWithLines(bill, admin)
        success += 1
      } catch (e) {
        failures.push({ id: bill?.Id, error: e instanceof Error ? e.message : 'Unknown error' })
      }
    }

    logger.info({ imported: success, failed: failures.length }, 'Buildium bills synced to DB')
    return NextResponse.json({ success: true, imported: success, failed: failures.length, failures })
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 501 })
    }
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
      await requireRole('platform_admin')
    }

    // Accept a single Buildium bill payload and upsert it
    const admin = requireSupabaseAdmin('buildium bills sync POST')
    const payload = await request.json()
    const { transactionId } = await upsertBillWithLines(payload, admin)
    return NextResponse.json({ success: true, transactionId }, { status: 201 })
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 501 })
    }
    return NextResponse.json({ error: 'Failed to upsert bill' }, { status: 400 })
  }
}
