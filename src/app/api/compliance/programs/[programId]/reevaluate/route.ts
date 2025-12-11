import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import { programTargetsAsset, programTargetsProperty } from '@/lib/compliance-programs'
import type { ComplianceProgram } from '@/types/compliance'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> },
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

    const { programId } = await params
    const body = (await request.json().catch(() => ({}))) as { apply?: boolean }
    const applyChanges = Boolean(body.apply)

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

    const { data: program, error: programError } = await supabaseAdmin
      .from('compliance_programs')
      .select('*')
      .eq('id', programId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    // Fetch items for this program
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('compliance_items')
      .select('id, property_id, asset_id, status, notes')
      .eq('program_id', programId)
      .eq('org_id', orgId)

    if (itemsError) {
      logger.error({ error: itemsError, programId, orgId }, 'Failed to fetch items for re-evaluate')
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
    }

    // Load properties and assets for matching
    const [propertiesRes, assetsRes] = await Promise.all([
      supabaseAdmin.from('properties').select('id, borough, bin').eq('org_id', orgId),
      supabaseAdmin.from('compliance_assets').select('id, property_id, asset_type, external_source, active, metadata').eq('org_id', orgId),
    ])

    if (propertiesRes.error) {
      logger.error({ error: propertiesRes.error, orgId }, 'Failed to fetch properties for re-evaluate')
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 })
    }
    if (assetsRes.error) {
      logger.error({ error: assetsRes.error, orgId }, 'Failed to fetch assets for re-evaluate')
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
    }

    const propertyMap = new Map((propertiesRes.data || []).map((p) => [p.id, p]))
    const assetMap = new Map((assetsRes.data || []).map((a) => [a.id, a]))

    let nonMatching = 0
    let closed = 0
    const nonMatchingIds: string[] = []

    for (const item of items || []) {
      const property = propertyMap.get(item.property_id) || null
      const asset = item.asset_id ? assetMap.get(item.asset_id) || null : null
      const matches = item.asset_id
        ? programTargetsAsset(program as ComplianceProgram, asset as any, property as any)
        : programTargetsProperty(program as ComplianceProgram, property as any)

      if (!matches) {
        nonMatching++
        nonMatchingIds.push(item.id)
      }
    }

    if (applyChanges && nonMatchingIds.length > 0) {
      const closureNote = 'Auto-closed due to criteria mismatch'
      const { error: updateError } = await supabaseAdmin
        .from('compliance_items')
        .update({ status: 'closed', next_action: closureNote })
        .in('id', nonMatchingIds)
        .eq('org_id', orgId)

      if (updateError) {
        logger.error({ error: updateError, programId, orgId }, 'Failed to close non-matching items')
        return NextResponse.json({ error: 'Failed to close non-matching items' }, { status: 500 })
      }

      closed = nonMatchingIds.length
    }

    return NextResponse.json({
      program_id: programId,
      non_matching: nonMatching,
      closed,
      total_items: items?.length || 0,
      applied: applyChanges,
    })
  } catch (error) {
    logger.error({ error }, 'Error in program re-evaluate API')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
