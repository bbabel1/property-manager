import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; serviceHistoryId: string }> }) {
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

    const { id, serviceHistoryId } = await params;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/rentals/appliances/${id}/servicehistory/${serviceHistoryId}`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium appliance service history fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch appliance service history from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const serviceHistory = response.json ?? {};

    logger.info(`Buildium appliance service history fetched successfully`);

    return NextResponse.json({
      success: true,
      data: serviceHistory,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium appliance service history`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; serviceHistoryId: string }> }) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;
    const { id, serviceHistoryId } = await params
    const body = await request.json()

    // The service history update schema is identical to create per Buildium docs
    // We can reuse the create schema for validation to keep it simple
    const { BuildiumApplianceServiceHistoryCreateSchema } = await import('@/schemas/buildium')
    const { sanitizeAndValidate } = await import('@/lib/sanitize')
    const validated = sanitizeAndValidate(body, BuildiumApplianceServiceHistoryCreateSchema)

    const response = await buildiumFetch('PUT', `/rentals/appliances/${id}/servicehistory/${serviceHistoryId}`, undefined, validated, orgId)

    if (!response.ok) {
      const errorData = response.json ?? {}
      logger.error(`Buildium appliance service history update failed`)
      return NextResponse.json(
        { error: 'Failed to update appliance service history in Buildium', details: errorData },
        { status: response.status }
      )
    }

    const updated = response.json ?? {}
    logger.info(`Buildium appliance service history updated successfully`)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium appliance service history`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
