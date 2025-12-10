/**
 * Compliance Sync API Route
 * 
 * POST /api/compliance/sync
 * 
 * Manual trigger for compliance data sync from NYC APIs
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { ComplianceSyncService } from '@/lib/compliance-sync-service'
import { supabaseAdmin } from '@/lib/db'
import type { ComplianceSyncRequest } from '@/types/compliance'

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requireUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as ComplianceSyncRequest

    // Get org_id from user context or request body
    let orgId = body.org_id

    if (!orgId) {
      // Try to get org_id from user's org memberships
      const { data: membership } = await supabaseAdmin
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      if (!membership?.org_id) {
        return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
      }

      orgId = membership.org_id
    }

    const syncService = new ComplianceSyncService()

    if (body.property_id) {
      // Sync specific property
      const result = await syncService.syncPropertyCompliance(
        body.property_id,
        orgId,
        body.force || false
      )

      return NextResponse.json(result)
    } else {
      // Sync all properties for org (with BIN)
      const { data: properties, error: propertiesError } = await supabaseAdmin
        .from('properties')
        .select('id, bin')
        .eq('org_id', orgId)
        .not('bin', 'is', null)

      if (propertiesError) {
        logger.error({ error: propertiesError, orgId }, 'Failed to fetch properties for sync')
        return NextResponse.json(
          { error: 'Failed to fetch properties', details: propertiesError.message },
          { status: 500 }
        )
      }

      const results = await Promise.allSettled(
        (properties || []).map((property) =>
          syncService.syncPropertyCompliance(property.id, orgId, body.force || false)
        )
      )

      const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length
      const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length

      const totalSynced = results
        .filter((r) => r.status === 'fulfilled')
        .reduce(
          (acc, r) => {
            if (r.status === 'fulfilled') {
              acc.assets += r.value.synced_assets
              acc.events += r.value.synced_events
              acc.violations += r.value.synced_violations
              acc.items += r.value.updated_items
            }
            return acc
          },
          { assets: 0, events: 0, violations: 0, items: 0 }
        )

      return NextResponse.json({
        success: true,
        synced_properties: successful,
        failed_properties: failed,
        ...totalSynced,
      })
    }
  } catch (error) {
    logger.error({ error }, 'Error in compliance sync API')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
