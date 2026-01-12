import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { buildiumSync } from '@/lib/buildium-sync'
import type { Database } from '@/types/database'
import { resolveResourceOrg, requireOrgMember } from '@/lib/auth/org-guards'

type UnitRow = Database['public']['Tables']['units']['Row']
type UnitWithProperty = UnitRow & { properties?: { buildium_property_id: number | null } | null }

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = await requireRole('platform_admin')
    const db = auth.supabase

    const resolvedOrg = await resolveResourceOrg(db, 'unit', id)
    if (!resolvedOrg.ok) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }
    await requireOrgMember({ client: db, userId: auth.user.id, orgId: resolvedOrg.orgId })

    const { data: unit, error } = await db
      .from('units')
      .select('*, properties:property_id(buildium_property_id)')
      .eq('id', id)
      .eq('org_id', resolvedOrg.orgId)
      .maybeSingle<UnitWithProperty>()

    if (error || !unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    const resolvedBuildiumPropertyId = unit.buildium_property_id ?? unit.properties?.buildium_property_id ?? null
    const numericPropertyId = typeof resolvedBuildiumPropertyId === 'number'
      ? resolvedBuildiumPropertyId
      : resolvedBuildiumPropertyId != null
        ? Number(resolvedBuildiumPropertyId)
        : null

    if (!numericPropertyId) {
      return NextResponse.json({ error: 'Property must be synced to Buildium before syncing unit' }, { status: 422 })
    }

    const { properties, ...unitWithoutRelation } = unit as UnitWithProperty
    const payload = {
      ...unitWithoutRelation,
      buildium_property_id: numericPropertyId
    }

    const result = await buildiumSync.syncUnitToBuildium(payload)
    if (!result.success) {
      const errorMessage = result.error || 'Failed to sync unit to Buildium'
      logger.error({ unitId: id, error: errorMessage }, 'Unit sync to Buildium failed')
      return NextResponse.json({ error: errorMessage }, { status: 422 })
    }

    logger.info({ unitId: id, buildiumId: result.buildiumId }, 'Unit synced to Buildium via API route')

    return NextResponse.json({ success: true, buildium_unit_id: result.buildiumId })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Organization access denied' }, { status: 403 })
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      }
    }
    logger.error({ error }, 'Error syncing unit to Buildium')
    return NextResponse.json({ error: 'Failed to sync unit to Buildium' }, { status: 500 })
  }
}
