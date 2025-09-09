import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { logger } from '@/lib/logger'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const propertyId = searchParams.get('propertyId')
    const unitId = searchParams.get('unitId')

    let query = supabase.from('lease').select('*').order('updated_at', { ascending: false })
    if (status) query = query.eq('status', status)
    if (propertyId) query = query.eq('property_id', propertyId)
    if (unitId) query = query.eq('unit_id', unitId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e) {
    logger.error({ error: e }, 'Error listing leases from DB')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const syncBuildium = url.searchParams.get('syncBuildium') === 'true'
    const body = await request.json()

    // Resolve local property/unit UUIDs if Buildium IDs provided
    let { property_id, unit_id } = body
    if (!property_id && body.buildium_property_id) {
      const { data } = await supabase.from('properties').select('id').eq('buildium_property_id', body.buildium_property_id).single()
      property_id = data?.id
    }
    if (!unit_id && body.buildium_unit_id) {
      const { data } = await supabase.from('units').select('id').eq('buildium_unit_id', body.buildium_unit_id).single()
      unit_id = data?.id
    }

    if (!property_id || !unit_id) {
      return NextResponse.json({ error: 'property_id and unit_id (or corresponding Buildium IDs) are required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const insert = {
      property_id,
      unit_id,
      lease_from_date: body.lease_from_date,
      lease_to_date: body.lease_to_date ?? null,
      lease_type: body.lease_type ?? null,
      status: body.status || 'active',
      term_type: body.term_type ?? null,
      renewal_offer_status: body.renewal_offer_status ?? null,
      current_number_of_occupants: body.current_number_of_occupants ?? null,
      security_deposit: body.security_deposit ?? null,
      rent_amount: body.rent_amount ?? null,
      automatically_move_out_tenants: body.automatically_move_out_tenants ?? null,
      payment_due_day: body.payment_due_day ?? null,
      unit_number: body.unit_number ?? null,
      buildium_property_id: body.buildium_property_id ?? null,
      buildium_unit_id: body.buildium_unit_id ?? null,
      created_at: now,
      updated_at: now,
    }

    const { data: created, error } = await supabase.from('lease').insert(insert).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let buildium: any = null
    if (syncBuildium) {
      // Build a minimal Buildium payload; users can POST full payload to /api/buildium/leases for complete control
      // Resolve Buildium IDs
      let PropertyId = body.buildium_property_id
      let UnitId = body.buildium_unit_id
      if (!PropertyId) {
        const { data: p } = await supabase.from('properties').select('buildium_property_id').eq('id', property_id).single()
        PropertyId = p?.buildium_property_id
      }
      if (!UnitId) {
        const { data: u } = await supabase.from('units').select('buildium_unit_id').eq('id', unit_id).single()
        UnitId = u?.buildium_unit_id
      }
      const payload: any = {
        PropertyId,
        UnitId,
        LeaseFromDate: body.lease_from_date,
        LeaseToDate: body.lease_to_date || undefined,
        LeaseType: body.lease_type || 'Standard',
        TermType: body.term_type || 'Fixed',
        RenewalOfferStatus: body.renewal_offer_status || 'NotOffered',
        CurrentNumberOfOccupants: body.current_number_of_occupants ?? undefined,
        IsEvictionPending: body.is_eviction_pending ?? undefined,
        AutomaticallyMoveOutTenants: body.automatically_move_out_tenants ?? undefined,
        PaymentDueDay: body.payment_due_day ?? undefined,
        AccountDetails: {
          Rent: body.rent_amount ?? 0,
          SecurityDeposit: body.security_deposit ?? 0,
        }
      }
      const res = await buildiumEdgeClient.createLeaseInBuildium(payload)
      if (res.success && res.data?.Id) {
        await supabase.from('lease').update({ buildium_lease_id: res.data.Id, buildium_updated_at: new Date().toISOString(), buildium_created_at: new Date().toISOString() }).eq('id', created.id)
        buildium = res.data
      }
    }

    return NextResponse.json({ lease: created, buildium }, { status: 201 })
  } catch (e) {
    logger.error({ error: e }, 'Error creating lease')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

