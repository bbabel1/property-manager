import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { BuildiumUnitCreateSchema } from '@/schemas/buildium'
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '50'
    const offset = searchParams.get('offset') || '0'
    const isActive = searchParams.get('isActive')

    const { id } = await params
    const q = new URLSearchParams()
    if (limit) q.append('limit', limit)
    if (offset) q.append('offset', offset)
    if (isActive) q.append('isActive', isActive)

    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
    const proxy = await edgeClient.proxyRaw('GET', `/rentals/${id}/units`, Object.fromEntries(q.entries()))
    if (!proxy.success) return NextResponse.json({ error: proxy.error || 'Failed to fetch property units from Buildium' }, { status: 502 })
    const units = Array.isArray(proxy.data) ? proxy.data : []
    return NextResponse.json({ success: true, data: units, count: units.length })
  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium property units')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard

    const { id } = await params
    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumUnitCreateSchema)
    validated.PropertyId = Number(id)

    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
    const prox = await edgeClient.proxyRaw('POST', `/rentals/${id}/units`, undefined, validated)
    if (!prox.success) return NextResponse.json({ error: prox.error || 'Failed to create property unit in Buildium' }, { status: 502 })
    const unit = prox.data
    return NextResponse.json({ success: true, data: unit }, { status: 201 })
  } catch (error) {
    logger.error({ error }, 'Error creating Buildium property unit')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
