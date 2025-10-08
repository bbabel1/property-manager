import { NextRequest, NextResponse } from 'next/server'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import { logger } from '@/lib/logger'

export async function GET(_req: NextRequest, { params }: { params: { buildiumLeaseId: string } }) {
  try {
    const id = Number(params.buildiumLeaseId)
    const res = await buildiumEdgeClient.getLeaseFromBuildium(id)
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed to fetch lease' }, { status: 404 })
    return NextResponse.json(res.data)
  } catch (e) {
    logger.error({ error: e }, 'Error fetching Buildium lease by id')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { buildiumLeaseId: string } }) {
  try {
    const id = Number(params.buildiumLeaseId)
    const body = await request.json().catch(() => ({}))
    const res = await buildiumEdgeClient.updateLeaseInBuildium(id, body)
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed to update lease in Buildium' }, { status: 400 })
    return NextResponse.json(res.data)
  } catch (e) {
    logger.error({ error: e }, 'Error updating Buildium lease')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

