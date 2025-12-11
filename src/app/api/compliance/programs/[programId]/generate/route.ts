/**
 * Generate compliance items for a program across the org's properties/assets
 * POST /api/compliance/programs/[programId]/generate
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'
import { ComplianceItemGenerator } from '@/lib/compliance-item-generator'

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
    const { periods_ahead } = await request.json().catch(() => ({}))
    const periodsAhead = typeof periods_ahead === 'number' ? periods_ahead : 12

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
      .single()

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    if (!program.is_enabled) {
      return NextResponse.json({ error: 'Program is disabled. Enable it before generating items.' }, { status: 400 })
    }

    const generator = new ComplianceItemGenerator()
    let itemsCreated = 0
    let itemsSkipped = 0
    const errors: string[] = []

    // Fetch properties for the org
    const { data: properties, error: propertiesError } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('org_id', orgId)

    if (propertiesError) {
      logger.error({ error: propertiesError, orgId }, 'Failed to fetch properties for generation')
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 })
    }

    // If program applies to assets, load assets too
    let assets: { id: string; property_id: string }[] = []
    if (program.applies_to === 'asset' || program.applies_to === 'both') {
      const { data: assetRows, error: assetsError } = await supabaseAdmin
        .from('compliance_assets')
        .select('id, property_id')
        .eq('org_id', orgId)
        .eq('active', true)

      if (assetsError) {
        logger.error({ error: assetsError, orgId }, 'Failed to fetch assets for generation')
        return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
      }
      assets = assetRows || []
    }

    for (const property of properties || []) {
      try {
        if (program.applies_to === 'asset') {
          const relatedAssets = assets.filter((a) => a.property_id === property.id)
          for (const asset of relatedAssets) {
            const result = await generator.generateItemsForProgram(
              programId,
              property.id,
              asset.id,
              orgId,
              periodsAhead,
            )
            itemsCreated += result.items_created
            itemsSkipped += result.items_skipped
            if (result.errors) errors.push(...result.errors)
          }
        } else {
          const result = await generator.generateItemsForProgram(
            programId,
            property.id,
            undefined,
            orgId,
            periodsAhead,
          )
          itemsCreated += result.items_created
          itemsSkipped += result.items_skipped
          if (result.errors) errors.push(...result.errors)
        }
      } catch (error) {
        errors.push(
          `Property ${property.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      items_created: itemsCreated,
      items_skipped: itemsSkipped,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    logger.error({ error }, 'Error generating compliance items for program')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
