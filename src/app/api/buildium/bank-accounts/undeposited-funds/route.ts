import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumFetch } from '@/lib/buildium-http'

export async function GET(_request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    logger.info({ userId: user.id, action: 'get_buildium_undeposited_funds' }, 'Fetching Buildium undeposited funds');

    // Buildium API call
    const response = await buildiumFetch('GET', '/bankaccounts/undepositedfunds', undefined, undefined, undefined);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const undepositedFunds = (response.json ?? []) as unknown[];

    return NextResponse.json({
      success: true,
      data: undepositedFunds,
      count: Array.isArray(undepositedFunds) ? undepositedFunds.length : 0
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium undeposited funds');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium undeposited funds', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
