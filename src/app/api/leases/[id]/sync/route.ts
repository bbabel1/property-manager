import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase, supabaseAdmin } from '@/lib/db'
import { buildiumSync } from '@/lib/buildium-sync'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request)
    const { id: leaseParam } = await params
    const leaseId = leaseParam
    const id = Number(leaseId)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 })
    }

    const db = supabaseAdmin || supabase

    const { data: lease, error: leaseError } = await db
      .from('lease')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (leaseError || !lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
    }

    let buildiumPropertyId = lease.buildium_property_id
    if (!buildiumPropertyId && lease.property_id) {
      const { data: propertyRow } = await db
        .from('properties')
        .select('buildium_property_id')
        .eq('id', lease.property_id)
        .maybeSingle()
      if (propertyRow?.buildium_property_id) buildiumPropertyId = Number(propertyRow.buildium_property_id)
    }

    let buildiumUnitId = lease.buildium_unit_id
    let unitNumber = (lease as any).unit_number
    if (!buildiumUnitId && lease.unit_id) {
      const { data: unitRow } = await db
        .from('units')
        .select('buildium_unit_id, unit_number')
        .eq('id', lease.unit_id)
        .maybeSingle()
      if (unitRow?.buildium_unit_id) buildiumUnitId = Number(unitRow.buildium_unit_id)
      if (!unitNumber && unitRow?.unit_number) unitNumber = unitRow.unit_number
    }

    if (!buildiumPropertyId) {
      return NextResponse.json({ error: 'Property must be synced to Buildium before syncing this lease' }, { status: 422 })
    }

    const payload = {
      ...lease,
      buildium_property_id: buildiumPropertyId,
      buildium_unit_id: buildiumUnitId ?? null,
      unit_number: unitNumber ?? (lease as any)?.unit_number ?? null
    }

    const result = await buildiumSync.syncLeaseToBuildium(payload)
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to sync lease to Buildium' }, { status: 422 })
    }

    logger.info({ leaseId: id, buildiumId: result.buildiumId }, 'Lease synced to Buildium')
    return NextResponse.json({ success: true, buildium_lease_id: result.buildiumId })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    logger.error({ error }, 'Error syncing lease to Buildium')
    return NextResponse.json({ error: 'Failed to sync lease to Buildium' }, { status: 500 })
  }
}
