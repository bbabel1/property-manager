import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { supabase, supabaseAdmin } from '@/lib/db';
import type { Database } from '@/types/database';

const BOROUGH_NAMES: Record<string, string> = {
  '1': 'Manhattan',
  '2': 'Bronx',
  '3': 'Brooklyn',
  '4': 'Queens',
  '5': 'Staten Island',
};

type BuildingRow = Database['public']['Tables']['buildings']['Row'];
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
  | 'building_id'
> & {
  building: BuildingRow | null;
};
type RawPropertyRow = Omit<PropertyRow, 'building'> & {
  building: BuildingRow | BuildingRow[] | null;
};

type BuildingSummary = {
  id: string;
  streetAddress: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  borough: string | null;
  neighborhood: string | null;
  ntaName: string | null;
  bbl: string | null;
  bin: string | null;
  parid: string | null;
  latitude: number | null;
  longitude: number | null;
  occupancyGroup: string | null;
  occupancyDescription: string | null;
  isOneTwoFamily: boolean | null;
  isPrivateResidenceBuilding: boolean | null;
  residentialUnits: number | null;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  properties: Array<{
    id: string;
    name: string;
    status: string | null;
    addressLine1: string | null;
    city: string | null;
    state: string | null;
  }>;
};

const boroughFromCode = (code: string | null) => (code ? (BOROUGH_NAMES[code] ?? code) : null);

const formatStreetAddress = (building: BuildingRow, fallback?: string | null) => {
  if (building.raw_address) return building.raw_address;
  const street = [building.house_number, building.street_name].filter(Boolean).join(' ').trim();
  if (street.length > 0) return street;
  return fallback || 'Unspecified address';
};

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = supabaseAdmin || supabase;
    const { data: membership, error: membershipError } = await db
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    const orgId = membership.org_id;
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
        building_id,
        building:buildings(
          id,
          raw_address,
          house_number,
          street_name,
          city,
          state,
          zip_code,
          borough_code,
          borough,
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
          residential_units,
          created_at,
          updated_at
        )
      `,
      )
      .eq('org_id', orgId)
      .not('building_id', 'is', null);

    if (error) {
      console.error('Error fetching buildings list', error);
      return NextResponse.json({ error: 'Failed to fetch buildings' }, { status: 500 });
    }

    const buildingMap = new Map<string, BuildingSummary>();
    const rows: PropertyRow[] = ((data || []) as RawPropertyRow[]).map((row) => ({
      ...row,
      building: Array.isArray(row.building) ? row.building[0] ?? null : row.building,
    }));

    for (const row of rows) {
      const building = Array.isArray(row.building) ? row.building[0] : row.building;
      if (!building?.id) continue;

      if (!buildingMap.has(building.id)) {
        buildingMap.set(building.id, {
          id: building.id,
          streetAddress: formatStreetAddress(building, row.address_line1),
          city: building.city || row.city || null,
          state: building.state || row.state || null,
          postalCode: building.zip_code || row.postal_code || null,
          borough: building.borough || boroughFromCode(building.borough_code),
          neighborhood: building.neighborhood,
          ntaName: building.nta_name,
          bbl: building.bbl,
          bin: building.bin,
          parid: building.parid,
          latitude: building.latitude,
          longitude: building.longitude,
          occupancyGroup: building.occupancy_group,
          occupancyDescription: building.occupancy_description,
          isOneTwoFamily: building.is_one_two_family,
          isPrivateResidenceBuilding: building.is_private_residence_building,
          residentialUnits: building.residential_units,
          totalUnits: 0,
          occupiedUnits: 0,
          vacantUnits: 0,
          occupancyRate: 0,
          properties: [],
        });
      }

      const summary = buildingMap.get(building.id)!;
      summary.properties.push({
        id: row.id,
        name: row.name,
        status: row.status ?? null,
        addressLine1: row.address_line1 ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
      });

      const propertyUnits = row.total_units ?? 0;
      const propertyOccupied = row.total_occupied_units ?? 0;
      const propertyVacant =
        row.total_vacant_units ?? Math.max(propertyUnits - propertyOccupied, 0);

      summary.totalUnits += propertyUnits;
      summary.occupiedUnits += propertyOccupied;
      summary.vacantUnits += propertyVacant;
    }

    const payload = Array.from(buildingMap.values()).map((summary) => {
      if (!summary.totalUnits && summary.residentialUnits) {
        summary.totalUnits = summary.residentialUnits;
      }
      if (
        !summary.vacantUnits &&
        summary.totalUnits &&
        summary.totalUnits > summary.occupiedUnits
      ) {
        summary.vacantUnits = summary.totalUnits - summary.occupiedUnits;
      }
      const total = summary.totalUnits || 0;
      const occupancyRate = total > 0 ? Math.round((summary.occupiedUnits / total) * 100) : 0;
      return { ...summary, occupancyRate };
    });

    payload.sort((a, b) => a.streetAddress.localeCompare(b.streetAddress));

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Unexpected error fetching buildings', error);
    return NextResponse.json({ error: 'Failed to fetch buildings' }, { status: 500 });
  }
}
