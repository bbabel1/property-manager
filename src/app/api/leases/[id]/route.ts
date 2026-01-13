import { NextRequest, NextResponse } from 'next/server'
import { requireSupabaseAdmin } from '@/lib/supabase-client'
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client'
import { logger } from '@/lib/logger'
import { requireAuth } from '@/lib/auth/guards'
import { requireOrgMember } from '@/lib/auth/org-guards'
import { hasPermission } from '@/lib/permissions'

type LeaseRouteContext = { params: Promise<{ id: string }> }

const normalizeDateOnly = (value?: string | null): string | null => {
  if (!value) return null
  // Keep date-only strings intact; otherwise fall back to parsed ISO date
  const datePart = typeof value === 'string' ? value.slice(0, 10) : ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

export async function GET(_req: NextRequest, context: LeaseRouteContext) {
  try {
    const { supabase, user, roles } = await requireAuth()
    if (!hasPermission(roles, 'leases.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const leaseId = Number(id)
    const { data: scopedLease, error: scopedErr } = await supabase
      .from('lease')
      .select('id, org_id')
      .eq('id', leaseId)
      .maybeSingle()
    if (scopedErr) return NextResponse.json({ error: scopedErr.message }, { status: 500 })
    if (!scopedLease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 })

    const orgId = String((scopedLease as any).org_id)
    try {
      await requireOrgMember({ client: supabase, userId: user.id, orgId })
    } catch (memberErr) {
      const msg = memberErr instanceof Error ? memberErr.message : ''
      const status = msg === 'ORG_FORBIDDEN' ? 403 : 401
      return NextResponse.json({ error: 'Forbidden' }, { status })
    }

    const db = requireSupabaseAdmin('lease route GET')
    const { data, error } = await db.from('lease').select('*').eq('id', leaseId).eq('org_id', orgId).maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Lease not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch (err) {
    if (err instanceof Error && err.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    logger.error({ error: err }, 'Error fetching lease')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: LeaseRouteContext) {
  try {
    const { supabase, user, roles } = await requireAuth()
    if (!hasPermission(roles, 'leases.write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const db = requireSupabaseAdmin('lease route PUT')
    const { id } = await context.params
    const leaseId = Number(id)

    const { data: scopedLease, error: scopedErr } = await supabase
      .from('lease')
      .select('id, org_id')
      .eq('id', leaseId)
      .maybeSingle()
    if (scopedErr) return NextResponse.json({ error: scopedErr.message }, { status: 500 })
    if (!scopedLease) return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
    const orgId = String((scopedLease as any).org_id)
    try {
      await requireOrgMember({ client: supabase, userId: user.id, orgId })
    } catch (memberErr) {
      const msg = memberErr instanceof Error ? memberErr.message : ''
      const status = msg === 'ORG_FORBIDDEN' ? 403 : 401
      return NextResponse.json({ error: 'Forbidden' }, { status })
    }

    const { data: leaseRow, error: leaseErr } = await db
      .from('lease')
      .select('*')
      .eq('id', leaseId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (leaseErr) return NextResponse.json({ error: leaseErr.message }, { status: 404 })
    if (!leaseRow) return NextResponse.json({ error: 'Lease not found' }, { status: 404 })

    const url = new URL(request.url)
    const syncBuildium = url.searchParams.get('syncBuildium') === 'true'
    const body = await request.json()
    const patch = { ...body, updated_at: new Date().toISOString() }
    const { data: updated, error } = await db
      .from('lease')
      .update(patch)
      .eq('id', leaseId)
      .eq('org_id', (leaseRow as any).org_id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    let buildiumSyncError: string | null = null
    let buildiumLeaseId: number | null = updated.buildium_lease_id ?? null
    if (syncBuildium || buildiumLeaseId) {
      const leaseFromDate = normalizeDateOnly(updated.lease_from_date ?? leaseRow.lease_from_date)
      const leaseToDate = normalizeDateOnly(updated.lease_to_date ?? leaseRow.lease_to_date)
      if (!leaseFromDate) {
        buildiumSyncError = 'Lease start date missing; cannot sync to Buildium'
      }
      // Prepare Buildium payload; prefer direct fields if provided
      if (!buildiumSyncError) {
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
          LeaseFromDate: leaseFromDate,
          LeaseToDate: leaseToDate || undefined,
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
