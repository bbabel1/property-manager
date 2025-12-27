import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client'
import { logger } from '@/lib/logger'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    
    const body = await request.json()
    const { forceSync = false, orgId: bodyOrgId } = body

    // Resolve orgId from request context or body
    let orgId: string | undefined = bodyOrgId
    if (!orgId) {
      try {
        orgId = await resolveOrgIdFromRequest(request, user.id)
      } catch (error) {
        // If orgId resolution fails, allow undefined (will use env vars)
        logger.warn({ userId: user.id, error }, 'Could not resolve orgId, falling back to env vars')
      }
    }

    logger.info({ userId: user.id, forceSync, orgId }, 'Starting bank accounts sync from Buildium')

    // Use org-scoped client helper
    const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId)

    // Sync bank accounts from Buildium
    const result = await edgeClient.syncBankAccountsFromBuildium({ forceSync })

    if (result.success) {
      const summary = (result.data || {}) as {
        synced?: number
        updated?: number
        errorCount?: number
        syncedCount?: number
        updatedCount?: number
      }
      logger.info({ 
        userId: user.id, 
        syncedCount: summary.syncedCount ?? summary.synced,
        updatedCount: summary.updatedCount ?? summary.updated,
        errorCount: summary.errorCount 
      }, 'Bank accounts sync completed successfully')
      
      return NextResponse.json({
        success: true,
        message: 'Bank accounts synced successfully',
        data: result.data
      })
    } else {
      logger.error({ 
        userId: user.id, 
        error: result.error 
      }, 'Bank accounts sync failed')
      
      return NextResponse.json(
        { 
          success: false,
          error: result.error || 'Failed to sync bank accounts' 
        },
        { status: 500 }
      )
    }

  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Error syncing bank accounts from Buildium')
    
    return NextResponse.json(
      { error: 'Failed to sync bank accounts' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    
    // Resolve orgId from request context
    let orgId: string | undefined
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id)
    } catch (error) {
      // If orgId resolution fails, allow undefined (will use env vars)
      logger.warn({ userId: user.id, error }, 'Could not resolve orgId, falling back to env vars')
    }

    // Use org-scoped client helper
    const client = await getOrgScopedBuildiumEdgeClient(orgId)
    
    const url = new URL(request.url)
    const { searchParams } = url
    
    const bankAccountId = searchParams.get('bankAccountId')

    if (bankAccountId) {
      // Get sync status for specific bank account
      const result = await client.getBankAccountSyncStatus(bankAccountId)
      
      if (result.success) {
        return NextResponse.json(result.data)
      } else {
        return NextResponse.json(
          { error: result.error || 'Failed to get bank account sync status' },
          { status: 500 }
        )
      }
    } else {
      // Get all bank account sync statuses
      const result = await client.getAllBankAccountSyncStatuses()
      
      if (result.success) {
        return NextResponse.json(result.data)
      } else {
        return NextResponse.json(
          { error: result.error || 'Failed to get bank account sync statuses' },
          { status: 500 }
        )
      }
    }

  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    logger.error({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 'Error getting bank account sync status')
    
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}
