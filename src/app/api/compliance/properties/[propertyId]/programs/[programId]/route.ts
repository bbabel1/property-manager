import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ComplianceService } from '@/lib/compliance-service'
import { ComplianceItemGenerator } from '@/lib/compliance-item-generator'
import type { ComplianceProgram } from '@/types/compliance'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; programId: string }> }
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

    const { propertyId, programId } = await params
    const body = await request.json().catch(() => ({}))
    const { is_enabled } = body as { is_enabled?: boolean | null }

    if (typeof is_enabled !== 'boolean' && is_enabled !== null) {
      return NextResponse.json({ error: 'is_enabled must be boolean or null' }, { status: 400 })
    }

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

    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    const { data: program, error: programError } = await supabaseAdmin
      .from('compliance_programs')
      .select('*')
      .eq('id', programId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    const { data: override, error: overrideError } = await supabaseAdmin
      .from('compliance_property_program_overrides')
      .upsert(
        {
          org_id: orgId,
          property_id: propertyId,
          program_id: programId,
          is_enabled,
          is_assigned: true,
          assigned_at: new Date().toISOString(),
          assigned_by: user.id,
        },
        { onConflict: 'property_id,program_id' }
      )
      .select()
      .maybeSingle()

    if (overrideError) {
      logger.error({ error: overrideError, propertyId, programId, orgId }, 'Failed to save program override')
      return NextResponse.json({ error: 'Failed to save override' }, { status: 500 })
    }

    const effective_is_enabled = typeof override?.is_enabled === 'boolean' ? override.is_enabled : program.is_enabled

    if (effective_is_enabled) {
      try {
        const generator = new ComplianceItemGenerator()
        const tasks: Promise<unknown>[] = []
        if ((program as ComplianceProgram).applies_to === 'property' || (program as ComplianceProgram).applies_to === 'both') {
          tasks.push(generator.generateItemsForProperty(propertyId, orgId, 12))
        }
        if ((program as ComplianceProgram).applies_to === 'asset' || (program as ComplianceProgram).applies_to === 'both') {
          const assets = await ComplianceService.getAssetsByProperty(propertyId, orgId)
          const uniqueAssetIds = Array.from(new Set((assets || []).map((asset) => asset.id as string)))
          if (uniqueAssetIds.length) {
            tasks.push(
              Promise.all(
                uniqueAssetIds.map((assetId) =>
                  generator.generateItemsForAsset(assetId as string, orgId, 12),
                ),
              ),
            )
          }
        }
        if (tasks.length) {
          await Promise.all(tasks)
        }
      } catch (genErr) {
        logger.error({ error: genErr, propertyId, programId, orgId }, 'Failed to generate items after toggle')
      }
    }

    return NextResponse.json({
      override,
      effective_is_enabled,
      program,
    })
  } catch (error) {
    logger.error({ error }, 'Error updating property compliance program override')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; programId: string }> }
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

    const { propertyId, programId } = await params

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

    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    const { data: program, error: programError } = await supabaseAdmin
      .from('compliance_programs')
      .select('*')
      .eq('id', programId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    const { data: override, error: overrideError } = await supabaseAdmin
      .from('compliance_property_program_overrides')
      .upsert(
        {
          org_id: orgId,
          property_id: propertyId,
          program_id: programId,
          is_enabled: null,
          is_assigned: false,
          assigned_at: new Date().toISOString(),
          assigned_by: user.id,
        },
        { onConflict: 'property_id,program_id' }
      )
      .select()
      .maybeSingle()

    if (overrideError) {
      logger.error({ error: overrideError, propertyId, programId, orgId }, 'Failed to suppress program override')
      return NextResponse.json({ error: 'Failed to remove program from property' }, { status: 500 })
    }

    return NextResponse.json({
      override,
      effective_is_enabled: false,
      suppressed: true,
      program,
    })
  } catch (error) {
    logger.error({ error }, 'Error suppressing property compliance program override')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
