import { NextRequest, NextResponse } from 'next/server'
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { logger } from '@/lib/logger'
import { requireRole } from '@/lib/auth/guards'

export async function GET(request: NextRequest, { params }: { params: Promise<{ buildiumLeaseId: string }> }) {
  try {
    const { user } = await requireRole('platform_admin')
    
    // Resolve orgId from request context
    let orgId: string | undefined;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id);
    } catch (error) {
      logger.warn({ userId: user.id, error }, 'Could not resolve orgId, falling back to env vars');
    }

    const { buildiumLeaseId } = await params
    const id = Number(buildiumLeaseId)
    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
    const res = await edgeClient.getLeaseFromBuildium(id)
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed to fetch lease' }, { status: 404 })
    return NextResponse.json(res.data)
  } catch (e) {
    logger.error({ error: e }, 'Error fetching Buildium lease by id')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ buildiumLeaseId: string }> }) {
  try {
    const { user } = await requireRole('platform_admin')
    
    // Resolve orgId from request context
    let orgId: string | undefined;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id);
    } catch (error) {
      logger.warn({ userId: user.id, error }, 'Could not resolve orgId, falling back to env vars');
    }

    const { buildiumLeaseId } = await params
    const id = Number(buildiumLeaseId)
    const body = await request.json().catch(() => ({}))
    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
    const res = await edgeClient.updateLeaseInBuildium(id, body)
    if (!res.success) return NextResponse.json({ error: res.error || 'Failed to update lease in Buildium' }, { status: 400 })
    return NextResponse.json(res.data)
  } catch (e) {
    logger.error({ error: e }, 'Error updating Buildium lease')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
