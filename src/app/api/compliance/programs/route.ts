/**
 * Compliance Programs API
 * GET /api/compliance/programs - list programs for the user's org
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/db'
import { sanitizeProgramCriteria } from '@/lib/compliance-programs'
import type { Json, TablesInsert } from '@/types/database'

const VALID_JURISDICTIONS = ['NYC_DOB', 'NYC_HPD', 'FDNY', 'NYC_DEP', 'OTHER']
const VALID_APPLIES_TO = ['property', 'asset', 'both']
const clampSeverity = (value: number | undefined | null) => {
  if (!Number.isFinite(value)) return 3
  return Math.min(Math.max(1, value as number), 5)
}

const toProgramCode = (value: string) => {
  const base = value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase()
    .slice(0, 50)
  const fallback = `PROGRAM_${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  return base || fallback
}

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

    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
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

    const codeInput = typeof body.code === 'string' ? body.code.trim() : ''
    const code = codeInput || toProgramCode(name)
    const jurisdiction = VALID_JURISDICTIONS.includes(body.jurisdiction)
      ? body.jurisdiction
      : 'OTHER'
    const appliesTo = VALID_APPLIES_TO.includes(body.applies_to) ? body.applies_to : 'property'
    const freq = Number(body.frequency_months)
    const frequencyMonths = Number.isFinite(freq) ? freq : 12
    const lead = Number(body.lead_time_days)
    const leadTimeDays = Number.isFinite(lead) ? lead : 30
    const severityScore = clampSeverity(Number(body.severity_score))
    const isEnabled = typeof body.is_enabled === 'boolean' ? body.is_enabled : true
    const notes = typeof body.notes === 'string' ? body.notes : null
    const overrideFields =
      body.override_fields && typeof body.override_fields === 'object' ? body.override_fields : {}
    const criteria = sanitizeProgramCriteria(body.criteria)

    const payload: TablesInsert<'compliance_programs'> = {
      org_id: orgId,
      template_id: null,
      code,
      name,
      jurisdiction,
      frequency_months: frequencyMonths,
      lead_time_days: leadTimeDays,
      applies_to: appliesTo,
      severity_score: severityScore,
      is_enabled: isEnabled,
      notes,
      override_fields: overrideFields as Json,
      criteria: (criteria ?? null) as Json | null,
    }

    const { data, error } = await supabaseAdmin
      .from('compliance_programs')
      .insert(payload)
      .select(
        `
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
      `,
      )
      .single()

    if (error) {
      const isConflict =
        typeof error.message === 'string' &&
        (error.message.includes('duplicate key value') || error.code === '23505')
      logger.error({ error, orgId }, 'Failed to create compliance program')
      return NextResponse.json(
        { error: isConflict ? 'A program with this code already exists' : 'Failed to create program' },
        { status: isConflict ? 409 : 500 },
      )
    }

    return NextResponse.json({ program: data })
  } catch (error) {
    logger.error({ error }, 'Error creating compliance program')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
