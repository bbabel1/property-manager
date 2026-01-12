import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    const guard = await getBuildiumOrgIdOr403(request)
    if ('response' in guard) return guard.response
    const { orgId } = guard
    logger.info({ userId: user.id, action: 'get_buildium_transfers' }, 'Fetching Buildium transfers');

    // Buildium API call
    const response = await buildiumFetch('GET', '/bankaccounts/transfers', undefined, undefined, orgId);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const transfers = (response.json ?? []) as unknown[];

    return NextResponse.json({
      success: true,
      data: transfers,
      count: Array.isArray(transfers) ? transfers.length : 0
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium transfers');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium transfers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;
    logger.info({ userId: user.id, action: 'create_buildium_transfer' }, 'Creating Buildium transfer');

    // Parse request body
    const body = await request.json();

    // Buildium API call
    const response = await buildiumFetch('POST', '/bankaccounts/transfers', undefined, body, orgId);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newTransfer = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: newTransfer
    }, { status: 201 });

  } catch (error) {
    logger.error({ error }, 'Error creating Buildium transfer');
    return NextResponse.json(
      { error: 'Failed to create Buildium transfer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
