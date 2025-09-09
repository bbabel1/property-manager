import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { BuildiumUnitCreateSchema } from '@/schemas/buildium'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireUser()

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '50'
    const offset = searchParams.get('offset') || '0'
    const isActive = searchParams.get('isActive')

    const q = new URLSearchParams()
    if (limit) q.append('limit', limit)
    if (offset) q.append('offset', offset)
    if (isActive) q.append('isActive', isActive)

    const proxy = await buildiumEdgeClient.proxyRaw('GET', `/rentals/${params.id}/units`, Object.fromEntries(q.entries()))
    if (!proxy.success) return NextResponse.json({ error: proxy.error || 'Failed to fetch property units from Buildium' }, { status: 502 })
    const units = proxy.data
    return NextResponse.json({ success: true, data: units, count: units.length })
  } catch (error) {
    logger.error('Error fetching Buildium property units', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireUser()

    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumUnitCreateSchema)
    validated.PropertyId = Number(params.id)

    const prox = await buildiumEdgeClient.proxyRaw('POST', `/rentals/${params.id}/units`, undefined, validated)
    if (!prox.success) return NextResponse.json({ error: prox.error || 'Failed to create property unit in Buildium' }, { status: 502 })
    const unit = prox.data
    return NextResponse.json({ success: true, data: unit }, { status: 201 })
  } catch (error) {
    logger.error('Error creating Buildium property unit', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
