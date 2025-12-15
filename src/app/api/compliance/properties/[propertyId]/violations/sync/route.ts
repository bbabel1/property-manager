import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ComplianceSyncService, type ViolationSource } from '@/lib/compliance-sync-service'

const ALLOWED_SOURCES: ViolationSource[] = [
  'dob_safety_violations',
  'dob_violations',
  'dob_active_violations',
  'dob_ecb_violations',
  'hpd_violations',
  'hpd_complaints',
  'fdny_violations',
  'asbestos_violations',
  'indoor_environmental_complaints',
  'sidewalk_violations',
  'backflow_prevention_violations',
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
      (s): s is ViolationSource => (ALLOWED_SOURCES as string[]).includes(s)
    )

    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id, org_id, bin, bbl, block, lot, building_id')
      .eq('id', propertyId)
      .maybeSingle()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    const { data: membership } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('org_id', (property as any).org_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let block = (property as any).block as string | null
    let lot = (property as any).lot as string | null

    if ((!block || !lot) && (property as any).building_id) {
      const { data: building } = await supabaseAdmin
        .from('buildings')
        .select('tax_block, tax_lot')
        .eq('id', (property as any).building_id)
        .maybeSingle()
      block = block || ((building as any)?.tax_block as string | null) || null
      lot = lot || ((building as any)?.tax_lot as string | null) || null
    }

    const service = new ComplianceSyncService()
    const results = []
    for (const source of includeSources) {
      const res = await service.syncViolationsBySource({
        source,
        propertyId,
        orgId: (property as any).org_id,
        bin: (property as any).bin || null,
        bbl: (property as any).bbl || null,
        block,
        lot,
      })
      results.push(res)
    }

    return NextResponse.json({ data: results })
  } catch (error) {
    logger.error({ error }, 'Failed to sync violations for property')
    return NextResponse.json(
      {
        error: 'Failed to sync violations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
