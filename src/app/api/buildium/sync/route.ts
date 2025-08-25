import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const user = await requireUser(request);
    
    const url = new URL(request.url);
    const { searchParams } = url;
    
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (entityId) {
      // Get sync status for specific entity
      const result = await buildiumEdgeClient.getSyncStatus(entityType || '', entityId);
      
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
      const result = await buildiumEdgeClient.getFailedSyncs(entityType || undefined);
      
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
    const user = await requireUser(request);
    
    const body = await request.json();
    const { entityType } = body;

    // Retry failed syncs
    const result = await buildiumEdgeClient.retryFailedSyncs(entityType);

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
