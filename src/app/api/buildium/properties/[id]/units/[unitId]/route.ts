import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { buildiumFetch } from '@/lib/buildium-http'
import { BuildiumUnitUpdateSchema } from '@/schemas/buildium'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; unitId: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireRole('platform_admin')

    const { id, unitId } = await params
    const res = await buildiumFetch('GET', `/rentals/${id}/units/${unitId}`, undefined, undefined, undefined)

    if (!res.ok) {
      const details = res.json ?? {}
      logger.error(`Buildium property unit fetch failed`)
      return NextResponse.json({ error: 'Failed to fetch property unit from Buildium', details }, { status: res.status })
    }
    const unit = res.json ?? {}
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
    await requireRole('platform_admin')

    const { id, unitId } = await params
    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumUnitUpdateSchema)
    validated.PropertyId = Number(id)

    const res = await buildiumFetch('PUT', `/rentals/${id}/units/${unitId}`, undefined, validated, undefined)

    if (!res.ok) {
      const details = res.json ?? {}
      logger.error(`Buildium property unit update failed`)
      return NextResponse.json({ error: 'Failed to update property unit in Buildium', details }, { status: res.status })
    }

    const unit = res.json ?? {}
    return NextResponse.json({ success: true, data: unit })
  } catch (error) {
    logger.error({ error }, 'Error updating Buildium property unit')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
