import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { BuildiumTenantUpdateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    const { user } = await requireRole('platform_admin')

    // Resolve orgId from request context
    let orgId: string | undefined;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id);
    } catch (error) {
      logger.warn({ userId: user.id, error }, 'Could not resolve orgId, falling back to env vars');
    }

    const { id } = await params
    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
    const proxy = await edgeClient.proxyRaw('GET', `/rentals/tenants/${id}`)
    if (!proxy.success) return NextResponse.json({ error: proxy.error || 'Failed to fetch tenant from Buildium' }, { status: 502 })
    const tenant = proxy.data
    logger.info('Buildium tenant fetched successfully')
    return NextResponse.json({ success: true, data: tenant })
  } catch (error) {
    logger.error({ error });
    logger.error('Error fetching Buildium tenant')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    const { user } = await requireRole('platform_admin')

    // Resolve orgId from request context
    let orgId: string | undefined;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id);
    } catch (error) {
      logger.warn({ userId: user.id, error }, 'Could not resolve orgId, falling back to env vars');
    }

    const { id } = await params
    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumTenantUpdateSchema)

    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
    const prox = await edgeClient.proxyRaw('PUT', `/rentals/tenants/${id}`, undefined, validated)
    if (!prox.success) return NextResponse.json({ error: prox.error || 'Failed to update tenant in Buildium' }, { status: 502 })
    const tenant = prox.data
    logger.info('Buildium tenant updated successfully')
    return NextResponse.json({ success: true, data: tenant })
  } catch (error) {
    logger.error({ error });
    logger.error('Error updating Buildium tenant')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
