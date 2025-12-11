import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { supabase, supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { Database } from '@/types/database'

const BOROUGH_NAMES: Record<string, string> = {
  '1': 'Manhattan',
  '2': 'Bronx',
  '3': 'Brooklyn',
  '4': 'Queens',
  '5': 'Staten Island',
}

type BuildingRow = Database['public']['Tables']['buildings']['Row']
type PropertyRow = Pick<
  Database['public']['Tables']['properties']['Row'],
  | 'id'
  | 'name'
  | 'status'
  | 'address_line1'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'total_units'
  | 'total_occupied_units'
  | 'total_vacant_units'
> & {
  building: BuildingRow | null
}

const boroughFromCode = (code: string | null) => (code ? BOROUGH_NAMES[code] ?? code : null)

const formatStreetAddress = (building: BuildingRow, fallback?: string | null) => {
  if (building.raw_address) return building.raw_address
  const street = [building.house_number, building.street_name].filter(Boolean).join(' ').trim()
  if (street.length > 0) return street
  return fallback || 'Unspecified address'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildingId: string }> },
) {
  try {
    const user = await requireUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { buildingId } = await params
    const db = supabaseAdmin || supabase

    const { data: membership, error: membershipError } = await db
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membershipError || !membership?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }
    const orgId = membership.org_id

    const { data, error } = await db
      .from('properties')
      .select(
        `
        id,
        name,
        status,
        address_line1,
        city,
        state,
        postal_code,
        total_units,
        total_occupied_units,
        total_vacant_units,
        building:buildings(
          id,
          raw_address,
          house_number,
          street_name,
          city,
          state,
          zip_code,
          borough_code,
          neighborhood,
          nta_name,
          bbl,
          bin,
          parid,
          latitude,
          longitude,
          occupancy_group,
          occupancy_description,
          is_one_two_family,
          is_private_residence_building,
          dwelling_unit_count,
          created_at,
          updated_at
        )
      `,
      )
      .eq('org_id', orgId)
      .eq('building_id', buildingId)

    if (error) {
      logger.error({ error, buildingId, orgId }, 'Failed to fetch building')
      return NextResponse.json({ error: 'Failed to fetch building' }, { status: 500 })
    }

    const rows = (data || []) as PropertyRow[]
    const first = rows.find((row) => row.building?.id === buildingId)

    if (!first?.building) {
      return NextResponse.json({ error: 'Building not found for org' }, { status: 404 })
    }

    let totalUnits = 0
    let occupiedUnits = 0
    let vacantUnits = 0

    const properties = rows.map((row) => {
      const propertyUnits = row.total_units ?? 0
      const propertyOccupied = row.total_occupied_units ?? 0
      const propertyVacant = row.total_vacant_units ?? Math.max(propertyUnits - propertyOccupied, 0)

      totalUnits += propertyUnits
      occupiedUnits += propertyOccupied
      vacantUnits += propertyVacant

      return {
        id: row.id,
        name: row.name,
        status: row.status ?? null,
        addressLine1: row.address_line1 ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        postalCode: row.postal_code ?? null,
        totalUnits: propertyUnits,
        occupiedUnits: propertyOccupied,
        vacantUnits: propertyVacant,
      }
    })

    if (!totalUnits && first.building.dwelling_unit_count) {
      totalUnits = first.building.dwelling_unit_count
    }
    if (!vacantUnits && totalUnits && totalUnits > occupiedUnits) {
      vacantUnits = totalUnits - occupiedUnits
    }

    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0

    const payload = {
      id: first.building.id,
      streetAddress: formatStreetAddress(first.building, first.address_line1),
      city: first.building.city || first.city || null,
      state: first.building.state || first.state || null,
      postalCode: first.building.zip_code || first.postal_code || null,
      borough: boroughFromCode(first.building.borough_code),
      neighborhood: first.building.neighborhood,
      ntaName: first.building.nta_name,
      bbl: first.building.bbl,
      bin: first.building.bin,
      parid: first.building.parid,
      latitude: first.building.latitude,
      longitude: first.building.longitude,
      occupancyGroup: first.building.occupancy_group,
      occupancyDescription: first.building.occupancy_description,
      isOneTwoFamily: first.building.is_one_two_family,
      isPrivateResidenceBuilding: first.building.is_private_residence_building,
      dwellingUnitCount: first.building.dwelling_unit_count,
      createdAt: first.building.created_at,
      updatedAt: first.building.updated_at,
      totalUnits,
      occupiedUnits,
      vacantUnits,
      occupancyRate,
      properties,
    }

    return NextResponse.json(payload)
  } catch (error) {
    logger.error({ error }, 'Error fetching building')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ buildingId: string }> },
) {
  try {
    const rate = await checkRateLimit(request)
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requireUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { buildingId } = await params
    const body = await request.json().catch(() => ({}))

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (membershipError || !membership?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 })
    }
    const orgId = membership.org_id

    // Ensure the building is linked to at least one property for this org
    const { data: propertyLink } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('building_id', buildingId)
      .eq('org_id', orgId)
      .limit(1)
      .maybeSingle()

    if (!propertyLink) {
      return NextResponse.json({ error: 'Building not found for org' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    if (typeof body.occupancy_group === 'string' || body.occupancy_group === null) updates.occupancy_group = body.occupancy_group
    if (typeof body.occupancy_description === 'string' || body.occupancy_description === null)
      updates.occupancy_description = body.occupancy_description
    if (typeof body.is_one_two_family === 'boolean' || body.is_one_two_family === null) updates.is_one_two_family = body.is_one_two_family
    if (typeof body.is_private_residence_building === 'boolean' || body.is_private_residence_building === null)
      updates.is_private_residence_building = body.is_private_residence_building
    if (typeof body.dwelling_unit_count === 'number' || body.dwelling_unit_count === null) updates.dwelling_unit_count = body.dwelling_unit_count

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
    }

    const { data: building, error: updateError } = await supabaseAdmin
      .from('buildings')
      .update(updates)
      .eq('id', buildingId)
      .select()
      .maybeSingle()

    if (updateError) {
      logger.error({ error: updateError, buildingId, orgId }, 'Failed to update building')
      return NextResponse.json({ error: 'Failed to update building' }, { status: 500 })
    }

    return NextResponse.json({ building })
  } catch (error) {
    logger.error({ error }, 'Error updating building')
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
