import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    const transferId = (await params).id;
    
    logger.info({ userId: user.id, transferId, action: 'get_buildium_transfer' }, 'Fetching Buildium transfer details');

    // Buildium API call
    const response = await buildiumFetch('GET', `/bankaccounts/transfers/${transferId}`, undefined, undefined, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Transfer not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const transfer = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: transfer
    });

  } catch (error) {
    logger.error({ error, transferId: (await params).id }, 'Error fetching Buildium transfer details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium transfer details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;
    const transferId = (await params).id;
    
    logger.info({ userId: user.id, transferId, action: 'update_buildium_transfer' }, 'Updating Buildium transfer');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await buildiumFetch('PUT', `/bankaccounts/transfers/${transferId}`, undefined, body, orgId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Transfer not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedTransfer = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: updatedTransfer
    });

  } catch (error) {
    logger.error({ error, transferId: (await params).id }, 'Error updating Buildium transfer');
    return NextResponse.json(
      { error: 'Failed to update Buildium transfer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
