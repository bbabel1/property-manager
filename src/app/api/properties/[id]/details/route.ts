import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { createServerClient } from '@supabase/ssr'

// GET /api/properties/:id/details
// Returns enriched property details with admin privileges to bypass RLS for joins
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Prefer service role if configured; else bind user session from cookies
    const db = supabaseAdmin || createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get: (name: string) => req.cookies.get(name)?.value,
          set: () => {},
          remove: () => {},
        },
      }
    )

    // Base property with aggregate unit counts and occupancy_rate
    const { data: property, error } = await db
      .from('properties')
      .select(`
        id, name, address_line1, address_line2, address_line3, city, state, postal_code, country,
        property_type, status, reserve, year_built, created_at, updated_at,
        borough, neighborhood, longitude, latitude, location_verified,
        service_assignment, service_plan,
        total_units, total_active_units, total_occupied_units, total_vacant_units, total_inactive_units,
        occupancy_rate,
        operating_bank_account_id, deposit_trust_account_id,
        ownerships (
          primary,
          ownership_percentage,
          disbursement_percentage,
          owners (*, contacts(*))
        )
      `)
      .eq('id', id)
      .single()

    if (error || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Build owners array (flatten), put primary first
    const ownerships = Array.isArray(property.ownerships) ? property.ownerships : []
    const normalizedOwners = ownerships.map((o: any) => {
      const c = Array.isArray(o.owners?.contacts) ? o.owners.contacts[0] : o.owners?.contacts
      return {
        // Preserve both owner id and contact details; avoid overriding owner id with contact id
        owner_id: o.owners?.id,
        ...o.owners,
        ...(c ? { contact_id: c.id, ...c } : {}),
        ownership_percentage: o.ownership_percentage,
        disbursement_percentage: o.disbursement_percentage,
        primary: !!o.primary,
      }
    })
    const owners = normalizedOwners.sort((a: any, b: any) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0))
    const total_owners = owners.length

    let primary_owner_name: string | undefined
    if (owners.length) {
      const po = owners.find((o: any) => o.primary) || owners[0]
      primary_owner_name = po?.company_name || [po?.first_name, po?.last_name].filter(Boolean).join(' ').trim() || undefined
    }

    // Banking names and units in parallel
    let operating_account: { id: string; name: string; last4?: string | null } | undefined
    let deposit_trust_account: { id: string; name: string; last4?: string | null } | undefined
    const [opRes, depRes, unitsRes] = await Promise.all([
      property.operating_bank_account_id
        ? db.from('bank_accounts').select('id, name, account_number').eq('id', property.operating_bank_account_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      property.deposit_trust_account_id
        ? db.from('bank_accounts').select('id, name, account_number').eq('id', property.deposit_trust_account_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      db.from('units').select('*').eq('property_id', id).order('unit_number')
    ])
    const op = (opRes as any).data
    const tr = (depRes as any).data
    const units = (unitsRes as any).data
    if (op) operating_account = { id: op.id, name: op.name, last4: op.account_number ? String(op.account_number).slice(-4) : null }
    if (tr) deposit_trust_account = { id: tr.id, name: tr.name, last4: tr.account_number ? String(tr.account_number).slice(-4) : null }

    // Units summary strictly from total_active_units and related aggregates
    const units_summary = {
      total: property.total_active_units ?? 0,
      occupied: property.total_occupied_units ?? 0,
      available: property.total_vacant_units ?? Math.max((property.total_active_units ?? 0) - (property.total_occupied_units ?? 0), 0),
    }

    const payload = {
      ...property,
      units: units || [],
      owners,
      total_owners,
      primary_owner_name,
      units_summary,
      operating_account,
      deposit_trust_account,
    }

    // Remove nested ownerships to keep payload clean
    delete (payload as any).ownerships

    return new NextResponse(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=15'
      }
    })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
