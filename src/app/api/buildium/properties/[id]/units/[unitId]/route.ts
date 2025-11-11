import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { BuildiumUnitUpdateSchema } from '@/schemas/buildium'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; unitId: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireUser()

    const { id, unitId } = await params
    const url = `${process.env.BUILDIUM_BASE_URL}/rentals/${id}/units/${unitId}`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    })

    if (!res.ok) {
      const details = await res.json().catch(() => ({}))
      logger.error(`Buildium property unit fetch failed`)
      return NextResponse.json({ error: 'Failed to fetch property unit from Buildium', details }, { status: res.status })
    }
    const unit = await res.json()
    return NextResponse.json({ success: true, data: unit })
  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium property unit')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; unitId: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireUser()

    const { id, unitId } = await params
    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumUnitUpdateSchema)
    validated.PropertyId = Number(id)

    const url = `${process.env.BUILDIUM_BASE_URL}/rentals/${id}/units/${unitId}`
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(validated)
    })

    if (!res.ok) {
      const details = await res.json().catch(() => ({}))
      logger.error(`Buildium property unit update failed`)
      return NextResponse.json({ error: 'Failed to update property unit in Buildium', details }, { status: res.status })
    }

    const unit = await res.json()
    return NextResponse.json({ success: true, data: unit })
  } catch (error) {
    logger.error({ error }, 'Error updating Buildium property unit')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
