import { NextRequest, NextResponse } from 'next/server'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import { logger } from '@/lib/logger'
import { requireRole } from '@/lib/auth/guards'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ buildiumLeaseId: string }> }) {
  try {
    await requireRole('platform_admin')
    const { buildiumLeaseId } = await params
    const id = Number(buildiumLeaseId)
    const res = await buildiumEdgeClient.getLeaseFromBuildium(id)
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed to fetch lease' }, { status: 404 })
    return NextResponse.json(res.data)
  } catch (e) {
    logger.error({ error: e }, 'Error fetching Buildium lease by id')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ buildiumLeaseId: string }> }) {
  try {
    await requireRole('platform_admin')
    const { buildiumLeaseId } = await params
    const id = Number(buildiumLeaseId)
    const body = await request.json().catch(() => ({}))
    const res = await buildiumEdgeClient.updateLeaseInBuildium(id, body)
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed to update lease in Buildium' }, { status: 400 })
    return NextResponse.json(res.data)
  } catch (e) {
    logger.error({ error: e }, 'Error updating Buildium lease')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
