import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/db'

// GET /api/properties/:id/details
// Returns enriched property details with admin privileges to bypass RLS for joins
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await params
    const id = resolved.id
    const db = supabaseAdmin || supabase

    // Base property with aggregate unit counts and occupancy_rate
    const { data: property, error } = await db
      .from('properties')
      .select(`
        id, name, address_line1, address_line2, address_line3, city, state, postal_code, country,
        property_type, status, reserve, year_built, created_at, updated_at,
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
        ...o.owners,
        ...c,
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

    // Banking names
    let operating_account: { id: string; name: string; last4?: string | null } | undefined
    if (property.operating_bank_account_id) {
      const { data: ba } = await db
        .from('bank_accounts')
        .select('id, name, account_number')
        .eq('id', property.operating_bank_account_id)
        .maybeSingle()
      if (ba) operating_account = { id: ba.id, name: ba.name, last4: ba.account_number ? String(ba.account_number).slice(-4) : null }
    }
    let deposit_trust_account: { id: string; name: string; last4?: string | null } | undefined
    if (property.deposit_trust_account_id) {
      const { data: ba } = await db
        .from('bank_accounts')
        .select('id, name, account_number')
        .eq('id', property.deposit_trust_account_id)
        .maybeSingle()
      if (ba) deposit_trust_account = { id: ba.id, name: ba.name, last4: ba.account_number ? String(ba.account_number).slice(-4) : null }
    }

    // Units summary strictly from total_active_units and related aggregates
    const units_summary = {
      total: property.total_active_units ?? 0,
      occupied: property.total_occupied_units ?? 0,
      available: property.total_vacant_units ?? Math.max((property.total_active_units ?? 0) - (property.total_occupied_units ?? 0), 0),
    }

    // Fetch units for this property so the Units tab can render a table
    const { data: units } = await db
      .from('units')
      .select('*')
      .eq('property_id', id)
      .order('unit_number')

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

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
