import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import type { Database } from '@/types/database'

type PropertyRow = Database['public']['Tables']['properties']['Row']
type BuildingRow = Database['public']['Tables']['buildings']['Row']
type OwnershipCacheRow = Database['public']['Tables']['property_ownerships_cache']['Row']
type OwnershipRow = Database['public']['Tables']['ownerships']['Row']
type OwnerRow = Database['public']['Tables']['owners']['Row']
type ContactRow = Database['public']['Tables']['contacts']['Row']
type GlAccountRow = Database['public']['Tables']['gl_accounts']['Row']
type UnitRow = Database['public']['Tables']['units']['Row']
type ServicePlanAssignmentRow = Database['public']['Tables']['service_plan_assignments']['Row']
type ServicePlanRow = Database['public']['Tables']['service_plans']['Row']

type OwnershipWithContact = OwnershipRow & {
  owners: (OwnerRow & { contacts: ContactRow | null }) | null
}

type OwnerSummary = {
  id: string | null
  owner_id: string | null
  contact_id: number | null
  display_name?: string | null
  primary_email?: string | null
  ownership_percentage?: number | null
  disbursement_percentage?: number | null
  primary: boolean
  company_name?: string | null
  first_name?: string | null
  last_name?: string | null
}

type MinimalAccount = { id: string; name: string; last4?: string | null }

type UnitsSummary = {
  total: number
  occupied: number
  available: number
}

type PropertyDetailsResponse = PropertySelection & {
  service_plan: string | null
  units: UnitRow[]
  owners: OwnerSummary[]
  total_owners: number
  primary_owner_name?: string
  units_summary: UnitsSummary
  operating_account?: MinimalAccount
  deposit_trust_account?: MinimalAccount
  property_manager_id: number | null
  property_manager_name?: string
  property_manager_email?: string
  property_manager_phone?: string
  primary_image_url?: undefined
  building: BuildingRow | null
}

type PropertySelection = Pick<
  PropertyRow,
  | 'id'
  | 'org_id'
  | 'buildium_property_id'
  | 'building_id'
  | 'name'
  | 'address_line1'
  | 'address_line2'
  | 'address_line3'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'country'
  | 'property_type'
  | 'status'
  | 'reserve'
  | 'year_built'
  | 'created_at'
  | 'updated_at'
  | 'borough'
  | 'neighborhood'
  | 'longitude'
  | 'latitude'
  | 'location_verified'
  | 'service_assignment'
  | 'total_units'
  | 'total_active_units'
  | 'total_occupied_units'
  | 'total_vacant_units'
  | 'total_inactive_units'
  | 'occupancy_rate'
  | 'operating_bank_gl_account_id'
  | 'deposit_trust_gl_account_id'
> & { service_assignment: PropertyRow['service_assignment'] }

// GET /api/properties/:id/details
// Returns enriched property details scoped to the caller's org membership
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user } = await requireAuth()
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const includeRaw = searchParams.get('include') || ''
    const include = new Set(includeRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))
    const includeUnits = include.has('units') || include.has('all')

    const orgId = await resolveOrgIdFromRequest(req, user.id, supabase)

    // Base property with aggregate unit counts and occupancy_rate. Avoid deep joins.
    const { data: property, error } = await supabase
      .from('properties')
      .select(`
        id, org_id, buildium_property_id, building_id, name, address_line1, address_line2, address_line3, city, state, postal_code, country,
        property_type, status, reserve, year_built, created_at, updated_at,
        borough, neighborhood, longitude, latitude, location_verified,
	        service_assignment,
	        total_units, total_active_units, total_occupied_units, total_vacant_units, total_inactive_units,
	        occupancy_rate,
        operating_bank_gl_account_id, deposit_trust_gl_account_id
      `)
      .eq('id', id)
      .eq('org_id', orgId)
      .single<PropertySelection>()

    if (error || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    }

    let building: BuildingRow | null = null
    if (property.building_id) {
      try {
        const { data: bldg } = await supabase
          .from('buildings')
          .select('*')
          .eq('id', property.building_id)
          .maybeSingle<BuildingRow>()
        building = bldg || null
      } catch {}
    }

    // Owners from cache: small, flat, indexed
    let owners: OwnerSummary[] = []
    type OwnershipCacheSelection = Pick<
      OwnershipCacheRow,
      | 'owner_id'
      | 'contact_id'
      | 'display_name'
      | 'primary_email'
      | 'ownership_percentage'
      | 'disbursement_percentage'
      | 'primary'
    >
    try {
      const { data: poc } = await supabase
        .from('property_ownerships_cache')
        .select('owner_id, contact_id, display_name, primary_email, ownership_percentage, disbursement_percentage, primary')
        .eq('property_id', id)
        .returns<OwnershipCacheSelection[]>()
      owners = (poc || []).map((o) => ({
        id: o.owner_id ?? null,
        owner_id: o.owner_id ?? null,
        contact_id: o.contact_id ?? null,
        display_name: o.display_name,
        primary_email: o.primary_email,
        ownership_percentage: o.ownership_percentage,
        disbursement_percentage: o.disbursement_percentage,
        primary: Boolean(o.primary),
      }))
      owners.sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0))
    } catch {}

    // Fallback: derive owners from ownerships → owners → contacts if cache is empty
    if (!owners.length) {
      try {
        const { data: ownerships } = await supabase
          .from('ownerships')
          .select(
            'owner_id, primary, ownership_percentage, disbursement_percentage, owners ( id, contact_id, contacts ( display_name, company_name, first_name, last_name ) )',
          )
          .eq('property_id', id)
          .eq('org_id', orgId)
        const list = (Array.isArray(ownerships) ? ownerships : []) as OwnershipWithContact[]
        owners = list.map((o) => {
          const contact = o?.owners?.contacts || null
          const displayName =
            contact?.display_name ||
            contact?.company_name ||
            [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() ||
            undefined
          return {
            id: o?.owner_id ?? null,
            owner_id: o?.owner_id ?? null,
            contact_id: o?.owners?.contact_id ?? null,
            display_name: displayName,
            ownership_percentage: o?.ownership_percentage,
            disbursement_percentage: o?.disbursement_percentage,
            primary: !!o?.primary,
            company_name: contact?.company_name,
            first_name: contact?.first_name,
            last_name: contact?.last_name,
          }
        })
        owners.sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0))
      } catch {}
    }
    const total_owners = owners.length

    const primary_owner_name = owners.length
      ? (owners.find((o) => o.primary) || owners[0])?.display_name ||
        owners[0]?.company_name ||
        [owners[0]?.first_name, owners[0]?.last_name].filter(Boolean).join(' ').trim() ||
        undefined
      : undefined

    // Banking names and units in parallel
    let operating_account: MinimalAccount | undefined
    let deposit_trust_account: MinimalAccount | undefined
    const [opRes, depRes, unitsRes] = await Promise.all([
      property.operating_bank_gl_account_id
        ? supabase
            .from('gl_accounts')
            .select('id, name, bank_account_number')
            .eq('id', property.operating_bank_gl_account_id)
            .eq('org_id', orgId)
            .maybeSingle<Pick<GlAccountRow, 'id' | 'name' | 'bank_account_number'>>()
        : Promise.resolve({ data: null } as { data: Pick<GlAccountRow, 'id' | 'name' | 'bank_account_number'> | null }),
      property.deposit_trust_gl_account_id
        ? supabase
            .from('gl_accounts')
            .select('id, name, bank_account_number')
            .eq('id', property.deposit_trust_gl_account_id)
            .eq('org_id', orgId)
            .maybeSingle<Pick<GlAccountRow, 'id' | 'name' | 'bank_account_number'>>()
        : Promise.resolve({ data: null } as { data: Pick<GlAccountRow, 'id' | 'name' | 'bank_account_number'> | null }),
      includeUnits
        ? supabase.from('units').select('*').eq('property_id', id).eq('org_id', orgId).order('unit_number')
        : Promise.resolve({ data: [] as UnitRow[] }),
    ])
    const op = opRes.data
    const tr = depRes.data
    const units = unitsRes.data || []
    if (op) {
      const acct = op.bank_account_number ?? null
      operating_account = { id: op.id, name: op.name, last4: acct ? String(acct).slice(-4) : null }
    }
    if (tr) {
      const acct = tr.bank_account_number ?? null
      deposit_trust_account = { id: tr.id, name: tr.name, last4: acct ? String(acct).slice(-4) : null }
    }

    // Units summary strictly from total_active_units and related aggregates
    const units_summary: UnitsSummary = {
      total: property.total_active_units ?? 0,
      occupied: property.total_occupied_units ?? 0,
      available: property.total_vacant_units ?? Math.max((property.total_active_units ?? 0) - (property.total_occupied_units ?? 0), 0),
    }

    // Resolve property manager (id + basic contact)
    let property_manager_id: number | null = null
    let property_manager_name: string | undefined = undefined
    let property_manager_email: string | undefined = undefined
    let property_manager_phone: string | undefined = undefined
    try {
      const { data: managerAssignment } = await supabase
        .from('property_staff')
        .select('staff_id, staff:staff_id(id, first_name, last_name, email, phone)')
        .eq('property_id', id)
        .eq('role', 'Property Manager')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const staffId = (managerAssignment as { staff_id?: number | null } | null)?.staff_id ?? null;
      if (typeof staffId === 'number') {
        property_manager_id = staffId;
        const staff = (managerAssignment as { staff?: { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null } | null } | null)?.staff;
        const nameParts = [staff?.first_name, staff?.last_name].filter(
          (value): value is string => Boolean(value && String(value).trim().length),
        );
        const displayName = nameParts.join(' ').trim();
        property_manager_name = displayName || staff?.email || undefined;
        property_manager_email = staff?.email ?? undefined;
        property_manager_phone = staff?.phone ?? undefined;
      }
    } catch (managerError) {
      console.warn('Failed to resolve property manager', managerError);
    }

    let service_plan: string | null = null
    try {
      const serviceAssignment = property?.service_assignment ?? null
      if (serviceAssignment === 'Property Level') {
        const { data: assignment } = await supabase
          .from('service_plan_assignments')
          .select('plan_id, service_plans(name)')
          .eq('property_id', id)
          .eq('org_id', orgId)
          .is('unit_id', null)
          .is('effective_end', null)
          .order('effective_start', { ascending: false })
          .limit(1)
          .maybeSingle<
            Pick<ServicePlanAssignmentRow, 'plan_id'> & {
              service_plans: Pick<ServicePlanRow, 'name'> | null
            }
          >()
        const plan = assignment?.service_plans
        service_plan = plan?.name ?? null
      }
    } catch {}

    const payload: PropertyDetailsResponse = {
      ...property,
      service_plan,
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
      primary_image_url: undefined,
      building,
    }

    return new NextResponse(JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=60'
      }
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 })
      }
    }
    console.error('Failed to fetch property details', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
