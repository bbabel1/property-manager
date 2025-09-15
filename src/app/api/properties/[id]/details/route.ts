import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { createServerClient } from '@supabase/ssr'

// GET /api/properties/:id/details
// Returns enriched property details with admin privileges to bypass RLS for joins
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const includeRaw = searchParams.get('include') || ''
    const include = new Set(includeRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))
    const includeUnits = include.has('units') || include.has('all')
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

    // Base property with aggregate unit counts and occupancy_rate. Avoid deep joins.
    const { data: property, error } = await db
      .from('properties')
      .select(`
        id, name, address_line1, address_line2, address_line3, city, state, postal_code, country,
        property_type, status, reserve, year_built, created_at, updated_at,
        borough, neighborhood, longitude, latitude, location_verified,
        service_assignment, service_plan,
        total_units, total_active_units, total_occupied_units, total_vacant_units, total_inactive_units,
        occupancy_rate,
        operating_bank_account_id, deposit_trust_account_id
      `)
      .eq('id', id)
      .single()

    if (error || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    // Owners from cache: small, flat, indexed
    let owners: any[] = []
    try {
      const { data: poc } = await db
        .from('property_ownerships_cache')
        .select('owner_id, contact_id, display_name, primary_email, ownership_percentage, disbursement_percentage, primary')
        .eq('property_id', id)
      owners = (poc || []).map((o: any) => ({
        id: o.owner_id,
        owner_id: o.owner_id,
        contact_id: o.contact_id,
        display_name: o.display_name,
        primary_email: o.primary_email,
        ownership_percentage: o.ownership_percentage,
        disbursement_percentage: o.disbursement_percentage,
        primary: !!o.primary,
      }))
      owners.sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0))
    } catch {}
    const total_owners = owners.length

    let primary_owner_name: string | undefined
    if (owners.length) {
      const po = owners.find((o: any) => o.primary) || owners[0]
      primary_owner_name = po?.company_name || [po?.first_name, po?.last_name].filter(Boolean).join(' ').trim() || undefined
    }

    // Banking names and units in parallel
    let operating_account: { id: string; name: string; last4?: string | null } | undefined
    let deposit_trust_account: { id: string; name: string; last4?: string | null } | undefined
    const [opRes, depRes, unitsRes, imgRes] = await Promise.all([
      property.operating_bank_account_id
        ? db.from('bank_accounts').select('id, name, account_number').eq('id', property.operating_bank_account_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      property.deposit_trust_account_id
        ? db.from('bank_accounts').select('id, name, account_number').eq('id', property.deposit_trust_account_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      includeUnits ? db.from('units').select('*').eq('property_id', id).order('unit_number') : Promise.resolve({ data: [] } as any),
      db.from('property_images').select('href').eq('property_id', id).order('updated_at', { ascending: false }).maybeSingle()
    ])
    const op = (opRes as any).data
    const tr = (depRes as any).data
    const units = (unitsRes as any).data
    const img = (imgRes as any).data
    if (op) operating_account = { id: op.id, name: op.name, last4: op.account_number ? String(op.account_number).slice(-4) : null }
    if (tr) deposit_trust_account = { id: tr.id, name: tr.name, last4: tr.account_number ? String(tr.account_number).slice(-4) : null }

    // Units summary strictly from total_active_units and related aggregates
    const units_summary = {
      total: property.total_active_units ?? 0,
      occupied: property.total_occupied_units ?? 0,
      available: property.total_vacant_units ?? Math.max((property.total_active_units ?? 0) - (property.total_occupied_units ?? 0), 0),
    }

    // Resolve property manager (id + basic contact)
    let property_manager_id: number | null = null
    let property_manager_name: string | undefined
    let property_manager_email: string | undefined
    let property_manager_phone: string | undefined
    try {
      const { data: link } = await db
        .from('property_staff')
        .select('staff_id, role')
        .eq('property_id', id)
        .eq('role', 'PROPERTY_MANAGER')
        .maybeSingle()
      if (link?.staff_id) {
        property_manager_id = Number(link.staff_id)
        const { data: st } = await db
          .from('staff')
          .select('id, first_name, last_name, email, phone')
          .eq('id', link.staff_id)
          .maybeSingle()
        if (st) {
          const full = [ (st as any).first_name, (st as any).last_name ].filter(Boolean).join(' ').trim()
          property_manager_name = full || `Staff ${st.id}`
          property_manager_email = (st as any).email || undefined
          property_manager_phone = (st as any).phone || undefined
        }
      }
    } catch {}

    const payload = {
      ...property,
      units: units || [],
      owners,
      total_owners,
      primary_owner_name,
      units_summary,
      operating_account,
      deposit_trust_account,
      property_manager_id,
      property_manager_name,
      property_manager_email,
      property_manager_phone,
      primary_image_url: img?.href || undefined,
    }

    // Ensure nested ownerships (from old joins) are absent
    delete (payload as any).ownerships

    return new NextResponse(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60'
      }
    })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
