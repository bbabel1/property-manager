import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import { logger } from '@/lib/logger'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id)
  const { data, error } = await supabase.from('lease').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    const url = new URL(request.url)
    const syncBuildium = url.searchParams.get('syncBuildium') === 'true'
    const body = await request.json()
    const patch = { ...body, updated_at: new Date().toISOString() }
    const { data: updated, error } = await supabase.from('lease').update(patch).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    let buildium: any = null
    if (syncBuildium) {
      // Prepare Buildium payload; prefer direct fields if provided
      let PropertyId = updated.buildium_property_id
      let UnitId = updated.buildium_unit_id
      if (!PropertyId) {
        const { data: p } = await supabase.from('properties').select('buildium_property_id').eq('id', updated.property_id).single()
        PropertyId = p?.buildium_property_id
      }
      if (!UnitId) {
        const { data: u } = await supabase.from('units').select('buildium_unit_id').eq('id', updated.unit_id).single()
        UnitId = u?.buildium_unit_id
      }
      const payload: any = {
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
      const buildiumId = updated.buildium_lease_id
      const res = buildiumId
        ? await buildiumEdgeClient.updateLeaseInBuildium(buildiumId, payload)
        : await buildiumEdgeClient.createLeaseInBuildium(payload)
      if (res.success && res.data?.Id) {
        await supabase.from('lease').update({ buildium_lease_id: res.data.Id, buildium_updated_at: new Date().toISOString() }).eq('id', id)
        buildium = res.data
      }
    }

    return NextResponse.json({ lease: updated, buildium })
  } catch (e) {
    logger.error({ error: e }, 'Error updating lease')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
