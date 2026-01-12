import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { BuildiumCheckUpdateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { buildiumFetch } from '@/lib/buildium-http'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: checkId } = await params
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    
    logger.info({ userId: user.id, checkId, action: 'get_buildium_check' }, 'Fetching Buildium check details');

    // Buildium API call
    const response = await buildiumFetch('GET', `/bankaccounts/checks/${checkId}`, undefined, undefined, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Check not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const check = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: check
    });

  } catch (error) {
    logger.error({ error, checkId }, 'Error fetching Buildium check details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium check details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: checkId } = await params
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    
    logger.info({ userId: user.id, checkId, action: 'update_buildium_check' }, 'Updating Buildium check');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumCheckUpdateSchema);

    // Buildium API call
    const response = await buildiumFetch('PUT', `/bankaccounts/checks/${checkId}`, undefined, data, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Check not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedCheck = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: updatedCheck
    });

  } catch (error) {
    logger.error({ error, checkId }, 'Error updating Buildium check');
    return NextResponse.json(
      { error: 'Failed to update Buildium check', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
