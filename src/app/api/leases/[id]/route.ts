import { NextRequest, NextResponse } from 'next/server'
import { requireSupabaseAdmin } from '@/lib/supabase-client'
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client'
import { logger } from '@/lib/logger'

type LeaseRouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, context: LeaseRouteContext) {
  const db = requireSupabaseAdmin('lease route GET')
  const { id } = await context.params
  const leaseId = Number(id)
  const { data, error } = await db.from('lease').select('*').eq('id', leaseId).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, context: LeaseRouteContext) {
  try {
    const db = requireSupabaseAdmin('lease route PUT')
    const { id } = await context.params
    const leaseId = Number(id)
    const url = new URL(request.url)
    const syncBuildium = url.searchParams.get('syncBuildium') === 'true'
    const body = await request.json()
    const patch = { ...body, updated_at: new Date().toISOString() }
    const { data: updated, error } = await db.from('lease').update(patch).eq('id', leaseId).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    let buildiumSyncError: string | null = null
    let buildiumLeaseId: number | null = updated.buildium_lease_id ?? null
    if (syncBuildium || buildiumLeaseId) {
      // Prepare Buildium payload; prefer direct fields if provided
      let PropertyId = updated.buildium_property_id
      let UnitId = updated.buildium_unit_id
      if (!PropertyId) {
        const { data: p } = await db.from('properties').select('buildium_property_id').eq('id', updated.property_id).single()
        PropertyId = p?.buildium_property_id ?? null
      }
      if (!UnitId) {
        const { data: u } = await db.from('units').select('buildium_unit_id').eq('id', updated.unit_id).single()
        UnitId = u?.buildium_unit_id ?? null
      }
      const payload: Record<string, unknown> = {
        PropertyId,
        UnitId,
        LeaseFromDate: updated.lease_from_date,
        LeaseToDate: updated.lease_to_date || undefined,
        LeaseType: updated.lease_type || 'Fixed',
        RenewalOfferStatus: updated.renewal_offer_status || 'NotOffered',
        CurrentNumberOfOccupants: updated.current_number_of_occupants ?? undefined,
        IsEvictionPending: updated.is_eviction_pending ?? undefined,
        AutomaticallyMoveOutTenants: updated.automatically_move_out_tenants ?? undefined,
        PaymentDueDay: updated.payment_due_day ?? undefined,
        AccountDetails: { Rent: updated.rent_amount ?? 0, SecurityDeposit: updated.security_deposit ?? 0 }
      }

      // Only attempt create when explicitly requested; otherwise update existing Buildium lease
      const buildiumId = updated.buildium_lease_id
      // Resolve orgId from lease record for org-scoped credentials
      const orgId = updated.org_id ?? undefined
      try {
        // Use org-scoped client for Buildium sync
        const edgeClient = await getOrgScopedBuildiumEdgeClient(orgId);
        if (buildiumId) {
          const res = await edgeClient.updateLeaseInBuildium(buildiumId, payload)
          if (res.success && res.data?.Id) {
            await db
              .from('lease')
              .update({ buildium_lease_id: res.data.Id, buildium_updated_at: new Date().toISOString() })
              .eq('id', leaseId)
            buildiumLeaseId = Number(res.data.Id)
          } else if (!res.success) {
            buildiumSyncError = res.error || 'Failed to sync lease to Buildium'
          }
        } else if (syncBuildium) {
          const res = await edgeClient.createLeaseInBuildium(payload)
          if (res.success && res.data?.Id) {
            await db
              .from('lease')
              .update({ buildium_lease_id: res.data.Id, buildium_updated_at: new Date().toISOString() })
              .eq('id', leaseId)
            buildiumLeaseId = Number(res.data.Id)
          } else if (!res.success) {
            buildiumSyncError = res.error || 'Failed to create lease in Buildium'
          }
        }
      } catch (syncError) {
        buildiumSyncError = syncError instanceof Error ? syncError.message : 'Failed to sync lease to Buildium'
      }
    }

    return NextResponse.json(
      {
        lease: updated,
        buildium_lease_id: buildiumLeaseId,
        buildium_sync_error: buildiumSyncError || undefined
      },
      { status: buildiumSyncError ? 422 : 200 }
    )
  } catch (e: unknown) {
    logger.error({ error: e }, 'Error updating lease')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
