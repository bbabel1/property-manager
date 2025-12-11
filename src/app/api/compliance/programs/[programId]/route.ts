/**
 * Compliance Program detail API
 * PATCH /api/compliance/programs/[programId] - update is_enabled or notes
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'
import { sanitizeProgramCriteria } from '@/lib/compliance-programs'

export async function PATCH(
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

    // Verify program belongs to org
    const { data: program, error: programError } = await supabaseAdmin
      .from('compliance_programs')
      .select('id')
      .eq('id', programId)
      .eq('org_id', orgId)
      .maybeSingle()

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.is_enabled === 'boolean') {
      updates.is_enabled = body.is_enabled
    }
    if (typeof body.notes === 'string') {
      updates.notes = body.notes
    }
    if (typeof body.jurisdiction === 'string') {
      updates.jurisdiction = body.jurisdiction
    }
    if (typeof body.applies_to === 'string') {
      updates.applies_to = body.applies_to
    }
    if (typeof body.frequency_months === 'number') {
      updates.frequency_months = body.frequency_months
    }
    if (typeof body.lead_time_days === 'number') {
      updates.lead_time_days = body.lead_time_days
    }
    if (body.override_fields && typeof body.override_fields === 'object') {
      updates.override_fields = body.override_fields
    }
    if (body.criteria !== undefined) {
      updates.criteria = sanitizeProgramCriteria(body.criteria)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('compliance_programs')
      .update(updates)
      .eq('id', programId)
      .eq('org_id', orgId)
      .select()
      .single()

    if (updateError) {
      logger.error({ error: updateError, programId, orgId }, 'Failed to update compliance program')
      return NextResponse.json({ error: 'Failed to update program' }, { status: 500 })
    }

    return NextResponse.json({ program: updated })
  } catch (error) {
    logger.error({ error }, 'Error updating compliance program')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
