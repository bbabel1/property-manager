import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumUnitUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import UnitService from '@/lib/unit-service';
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client';
import type { BuildiumUnit } from '@/types/buildium';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require platform admin
    await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const { id } = await params;

    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
    const proxy = await edgeClient.proxyRaw('GET', `/rentals/units/${id}`);
    if (!proxy.success) return NextResponse.json({ error: proxy.error || 'Failed to fetch unit from Buildium' }, { status: 502 });
    const unit = proxy.data as BuildiumUnit;
    // Optional persist to DB if ?persist=true|1
    const { searchParams } = new URL(request.url);
    const persist = ['1','true','yes'].includes((searchParams.get('persist') || '').toLowerCase());
    if (persist) {
      try { await UnitService.persistBuildiumUnit(unit as any, orgId) } catch (e) { logger.error(`Persist updated unit failed: ${String(e)}`) }
    }

    logger.info(`Buildium unit fetched successfully`);

    return NextResponse.json({
      success: true,
      data: unit,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium unit`);

    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json(
        { error: 'Organization context required' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require platform admin
    await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumUnitUpdateSchema);

    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
    const prox = await edgeClient.proxyRaw('PUT', `/rentals/units/${id}`, undefined, validatedData)
    if (!prox.success) return NextResponse.json({ error: prox.error || 'Failed to update unit in Buildium' }, { status: 502 })
    const unit = prox.data

    logger.info(`Buildium unit updated successfully`);

    return NextResponse.json({
      success: true,
      data: unit,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium unit`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
