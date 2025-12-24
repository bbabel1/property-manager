import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const { user } = await requireRole('platform_admin')
    
    const body = await request.json()
    const { forceSync = false } = body

    logger.info({ userId: user.id, forceSync }, 'Starting bank accounts sync from Buildium')

    // Sync bank accounts from Buildium
    const result = await buildiumEdgeClient.syncBankAccountsFromBuildium({ forceSync })

    if (result.success) {
      logger.info({ 
        userId: user.id, 
        syncedCount: result.data?.syncedCount,
        updatedCount: result.data?.updatedCount,
        errorCount: result.data?.errorCount 
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
    await requireRole('platform_admin')
    
    const url = new URL(request.url)
    const { searchParams } = url
    
    const bankAccountId = searchParams.get('bankAccountId')

    if (bankAccountId) {
      // Get sync status for specific bank account
      const result = await buildiumEdgeClient.getBankAccountSyncStatus(bankAccountId)
      
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
      const result = await buildiumEdgeClient.getAllBankAccountSyncStatuses()
      
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
