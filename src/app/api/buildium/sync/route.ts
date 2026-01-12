import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { logger } from '@/lib/logger'
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard'

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    
    const url = new URL(request.url);
    const { searchParams } = url;
    
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    // Use org-scoped client
    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);

    if (entityId) {
      // Get sync status for specific entity
      const result = await edgeClient.getSyncStatus(entityType || '', entityId);
      
      if (result.success) {
        return NextResponse.json(result.data);
      } else {
        return NextResponse.json(
          { error: result.error || 'Failed to get sync status' },
          { status: 500 }
        );
      }
    } else {
      // Get all failed syncs
      const result = await edgeClient.getFailedSyncs(entityType || undefined);
      
      if (result.success) {
        return NextResponse.json(result.data);
      } else {
        return NextResponse.json(
          { error: result.error || 'Failed to get failed syncs' },
          { status: 500 }
        );
      }
    }

  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error getting Buildium sync status');
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin');
    
    const body = await request.json();
    const { entityType } = body;

    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    // Use org-scoped client
    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);

    // Retry failed syncs
    const result = await edgeClient.retryFailedSyncs(entityType);

    if (result.success) {
      return NextResponse.json(result.data);
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to retry failed syncs' },
        { status: 500 }
      );
    }

  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error retrying failed syncs');
    return NextResponse.json(
      { error: 'Failed to retry failed syncs' },
      { status: 500 }
    );
  }
}
