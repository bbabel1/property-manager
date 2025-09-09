import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { BuildiumRecurringTransactionCreateSchema } from '@/schemas/buildium'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const user = await requireUser()
    const { id } = params
    const { searchParams } = new URL(request.url)
    const orderby = searchParams.get('orderby') || undefined
    const offset = searchParams.get('offset') || undefined
    const limit = searchParams.get('limit') || undefined
    const qs = new URLSearchParams()
    if (orderby) qs.append('orderby', orderby)
    if (offset) qs.append('offset', offset)
    if (limit) qs.append('limit', limit)

    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/leases/${id}/recurring-transactions?${qs.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('Buildium recurring transactions fetch failed')
      return NextResponse.json({ error: 'Failed to fetch Buildium recurring transactions', details: errorData }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json({ success: true, data, count: Array.isArray(data) ? data.length : 0 })
  } catch (error) {
    logger.error('Error fetching Buildium recurring transactions')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const user = await requireUser()
    const { id } = params
    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumRecurringTransactionCreateSchema)

    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/leases/${id}/recurring-transactions`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validated)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('Buildium recurring transaction create failed')
      return NextResponse.json({ error: 'Failed to create Buildium recurring transaction', details: errorData }, { status: response.status })
    }

    const created = await response.json()
    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (error) {
    logger.error('Error creating Buildium recurring transaction')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
