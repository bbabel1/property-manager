import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
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
    const body = await request.json().catch(() => ({}))

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

    const { data: asset, error: assetError } = await (supabaseAdmin as any)
      .from('compliance_assets')
      .select('id, org_id')
      .eq('id', assetId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (assetError || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.device_category === 'string' || body.device_category === null) updates.device_category = body.device_category
    if (typeof body.device_technology === 'string' || body.device_technology === null) updates.device_technology = body.device_technology
    if (typeof body.device_subtype === 'string' || body.device_subtype === null) updates.device_subtype = body.device_subtype
    if (typeof body.is_private_residence === 'boolean' || body.is_private_residence === null)
      updates.is_private_residence = body.is_private_residence

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await (supabaseAdmin as any)
      .from('compliance_assets')
      .update(updates)
      .eq('id', assetId)
      .eq('org_id', orgId)
      .select()
      .maybeSingle()

    if (updateError) {
      logger.error({ error: updateError, assetId, orgId }, 'Failed to update compliance asset')
      return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 })
    }

    return NextResponse.json({ asset: updated })
  } catch (error) {
    logger.error({ error }, 'Error updating compliance asset')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
