import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumTaskHistoryUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; historyId: string }> }) {
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

    const { id, historyId } = await params;

    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/tasks/${id}/history/${historyId}`, undefined, undefined, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium task history fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch task history from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const taskHistory = response.json ?? {};

    logger.info(`Buildium task history fetched successfully`);

    return NextResponse.json({
      success: true,
      data: taskHistory,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium task history`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; historyId: string }> }) {
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

    const { id, historyId } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumTaskHistoryUpdateSchema);

    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    // Make request to Buildium API
    const response = await buildiumFetch('PUT', `/tasks/${id}/history/${historyId}`, undefined, validatedData, orgId);

    if (!response.ok) {
      const errorData = response.json ?? {};
      logger.error(`Buildium task history update failed`);

      return NextResponse.json(
        { 
          error: 'Failed to update task history in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const taskHistory = response.json ?? {};

    logger.info(`Buildium task history updated successfully`);

    return NextResponse.json({
      success: true,
      data: taskHistory,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error updating Buildium task history`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
