import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/db'
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
    const strict = url.searchParams.get('strict') === 'true'
    const body = await request.json()
    const syncBuildium = (url.searchParams.get('syncBuildium') === 'true') || Boolean(body?.syncBuildium)

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

    // Idempotency handling
    const admin = supabaseAdmin || supabase
    const idemKey = request.headers.get('Idempotency-Key') || `lease:${property_id}:${unit_id}:${body.lease_from_date}:${body.lease_to_date || ''}`
    try {
      const { data: idem } = await admin.from('idempotency_keys').select('response').eq('key', idemKey).maybeSingle()
      if (idem?.response) return NextResponse.json(idem.response, { status: 201 })
    } catch {}

    // Atomic create via SQL function
    const payload = {
      lease: {
        property_id, unit_id,
        lease_from_date: body.lease_from_date,
        lease_to_date: body.lease_to_date ?? null,
        lease_type: body.lease_type ?? 'Fixed',
        payment_due_day: body.payment_due_day ?? null,
        security_deposit: body.security_deposit ?? null,
        rent_amount: body.rent_amount ?? null,
        prorated_first_month_rent: body.prorated_first_month_rent ?? null,
        prorated_last_month_rent: body.prorated_last_month_rent ?? null,
        renewal_offer_status: body.renewal_offer_status ?? null,
        status: body.status || 'active'
      },
      contacts: Array.isArray(body.contacts) ? body.contacts : [],
      rent_schedules: Array.isArray(body.rent_schedules) ? body.rent_schedules : [],
      recurring_transactions: Array.isArray(body.recurring_transactions) ? body.recurring_transactions : [],
      documents: Array.isArray(body.documents) ? body.documents : [],
    }
    // Create any new people requested by client (contact + tenant), append to contacts list
    if (Array.isArray(body.new_people) && body.new_people.length) {
      const createdTenantIds: { id: string; role: string }[] = []
      // Fetch property/unit addresses once
      const { data: prop } = await admin.from('properties').select('address_line1,address_line2,city,state,postal_code,country').eq('id', property_id).maybeSingle()
      const { data: uni } = await admin.from('units').select('unit_number').eq('id', unit_id).maybeSingle()
      for (const p of body.new_people as any[]) {
        const useUnitAddr = p.same_as_unit === true || (!p.addr1 && !p.city && !p.state && !p.postal && !p.country)
        const cPayload: any = {
          is_company: false,
          first_name: p.first_name,
          last_name: p.last_name,
          primary_email: p.email || null,
          primary_phone: p.phone || null,
          alt_phone: p.alt_phone || null,
          alt_email: p.alt_email || null,
          primary_address_line_1: useUnitAddr ? (prop?.address_line1 ?? null) : (p.addr1 ?? null),
          primary_address_line_2: useUnitAddr ? (prop?.address_line2 ?? (uni?.unit_number ? `Unit ${uni.unit_number}` : null)) : (p.addr2 ?? null),
          primary_city: useUnitAddr ? (prop?.city ?? null) : (p.city ?? null),
          primary_state: useUnitAddr ? (prop?.state ?? null) : (p.state ?? null),
          primary_postal_code: useUnitAddr ? (prop?.postal_code ?? null) : (p.postal ?? null),
          primary_country: useUnitAddr ? (prop?.country ?? null) : (p.country ?? null),
          alt_address_line_1: p.alt_addr1 ?? null,
          alt_address_line_2: p.alt_addr2 ?? null,
          alt_city: p.alt_city ?? null,
          alt_state: p.alt_state ?? null,
          alt_postal_code: p.alt_postal ?? null,
          alt_country: p.alt_country ?? null,
        }
        const { data: contact, error: cErr } = await admin.from('contacts').insert(cPayload).select('id').single()
        if (cErr) return NextResponse.json({ error: 'Failed creating contact', details: cErr.message }, { status: 400 })
        const { data: tenant, error: tErr } = await admin.from('tenants').insert({ contact_id: contact!.id }).select('id').single()
        if (tErr) return NextResponse.json({ error: 'Failed creating tenant', details: tErr.message }, { status: 400 })
        createdTenantIds.push({ id: tenant!.id, role: p.role || 'Tenant' })
      }
      if (createdTenantIds.length) {
        payload.contacts = [
          ...payload.contacts,
          ...createdTenantIds.map(t => ({ tenant_id: t.id, role: t.role, is_rent_responsible: t.role === 'Tenant' }))
        ]
      }
    }
    const { data: fnRes, error: fnErr } = await admin.rpc('fn_create_lease_aggregate', { payload })
    if (fnErr) return NextResponse.json({ error: 'Failed creating lease', details: fnErr.message }, { status: 500 })
    const lease_id = fnRes?.lease_id
    const { data: lease } = await admin.from('lease').select('*').eq('id', lease_id).single()
    const { data: contacts } = await admin.from('lease_contacts').select('*').eq('lease_id', lease_id)
    const { data: schedules } = await admin.from('rent_schedules').select('*').eq('lease_id', lease_id)
    const { data: recurs } = await admin.from('recurring_transactions').select('*').eq('lease_id', lease_id)
    const { data: docs } = await admin.from('lease_documents').select('*').eq('lease_id', lease_id)

    let buildium: any = null
    let buildiumWarning: any = null
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
        LeaseType: body.lease_type || 'Fixed',
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
        await admin.from('lease').update({ buildium_lease_id: res.data.Id, buildium_updated_at: new Date().toISOString(), buildium_created_at: new Date().toISOString(), sync_status: 'ok' }).eq('id', lease_id)
        buildium = res.data
      } else {
        buildiumWarning = { warning: res?.error || 'Buildium create failed' }
        await admin.from('lease').update({ sync_status: 'error', last_sync_error: buildiumWarning.warning, last_sync_attempt_at: new Date().toISOString() }).eq('id', lease_id)
        await admin.from('lease_sync_queue').insert({ lease_id, idempotency_key: idemKey, last_error: buildiumWarning.warning })
        if (strict) return NextResponse.json({ error: 'Buildium sync failed', details: buildiumWarning.warning }, { status: 502 })
      }
    }
    const response = { lease, contacts, rent_schedules: schedules, recurring_transactions: recurs, documents: docs, ...(buildium ? { buildium } : {}), ...(buildiumWarning ? { buildiumSync: buildiumWarning } : {}) }
    try { await admin.from('idempotency_keys').insert({ key: idemKey, response }) } catch {}
    return NextResponse.json(response, { status: 201 })
  } catch (e) {
    logger.error({ error: e }, 'Error creating lease')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
