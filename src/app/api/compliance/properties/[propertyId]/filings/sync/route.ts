import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import { syncBuildingPermitsFromOpenData, type PermitSource } from '@/lib/building-permit-sync'

const ALLOWED_SOURCES: PermitSource[] = [
  'dob_now_build_approved_permits',
  'dob_permit_issuance_old',
  'dob_job_applications',
  'dep_water_sewer_permits',
  'dep_water_sewer_permits_old',
  'dob_elevator_permit_applications',
  'hpd_registrations',
  'dob_now_safety_facade',
]

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  try {
    const user = await requireUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { propertyId } = await context.params
    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as { sources?: string[] }
    const requestedSources = Array.isArray(body.sources) ? body.sources : []
    const includeSources = (requestedSources.length ? requestedSources : ALLOWED_SOURCES).filter(
      (source): source is PermitSource => (ALLOWED_SOURCES as string[]).includes(source)
    )

    // Load property + org for auth/context
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id, org_id, bin, bbl, block, lot')
      .eq('id', propertyId)
      .maybeSingle()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Verify user membership in org
    const { data: membership } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('org_id', (property as any).org_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { results } = await syncBuildingPermitsFromOpenData({
      orgId: (property as any).org_id,
      propertyId,
      bin: (property as any).bin || null,
      bbl: (property as any).bbl || null,
      includeSources,
    })

    return NextResponse.json({ data: results })
  } catch (error) {
    logger.error({ error }, 'Failed to sync filings for property')
    return NextResponse.json(
      {
        error: 'Failed to sync filings',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
