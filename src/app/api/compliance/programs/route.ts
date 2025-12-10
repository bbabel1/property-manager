/**
 * Compliance Programs API
 * GET /api/compliance/programs - list programs for the user's org
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requireUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const { data, error } = await supabaseAdmin
      .from('compliance_programs')
      .select(`
        *,
        template:compliance_program_templates(
          id,
          code,
          name,
          jurisdiction,
          frequency_months,
          lead_time_days,
          applies_to,
          severity_score
        )
      `)
      .eq('org_id', orgId)
      .order('jurisdiction')

    if (error) {
      logger.error({ error, orgId }, 'Failed to fetch compliance programs')
      return NextResponse.json({ error: 'Failed to load programs' }, { status: 500 })
    }

    return NextResponse.json({ programs: data || [] })
  } catch (error) {
    logger.error({ error }, 'Error in compliance programs API')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
