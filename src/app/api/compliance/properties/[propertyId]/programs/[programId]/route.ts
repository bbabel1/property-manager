import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'

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

    if (is_enabled === null) {
      const { error: deleteError } = await supabaseAdmin
        .from('compliance_property_program_overrides')
        .delete()
        .eq('org_id', orgId)
        .eq('property_id', propertyId)
        .eq('program_id', programId)

      if (deleteError) {
        logger.error({ error: deleteError, propertyId, programId, orgId }, 'Failed to clear program override')
        return NextResponse.json({ error: 'Failed to update override' }, { status: 500 })
      }

      return NextResponse.json({
        override: null,
        effective_is_enabled: program.is_enabled,
        program,
      })
    }

    const { data: override, error: overrideError } = await supabaseAdmin
      .from('compliance_property_program_overrides')
      .upsert(
        {
          org_id: orgId,
          property_id: propertyId,
          program_id: programId,
          is_enabled,
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
