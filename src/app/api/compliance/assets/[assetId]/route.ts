/**
 * Asset Compliance API Route
 * 
 * GET /api/compliance/assets/[assetId]
 * 
 * Returns compliance data for a specific asset
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { ComplianceService } from '@/lib/compliance-service'
import { supabaseAdmin } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requireUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { assetId } = await params

    // Get org_id from user's org memberships
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membershipError || !membership?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }

    const orgId = membership.org_id

    // Fetch asset with relations
    const asset = await ComplianceService.getAssetById(assetId, orgId)

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    return NextResponse.json(asset)
  } catch (error) {
    logger.error({ error }, 'Error in asset compliance API')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
