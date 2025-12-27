import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  programTargetsAsset,
  programTargetsProperty,
  sanitizeProgramCriteria,
} from '@/lib/compliance-programs';
import type { ComplianceProgram } from '@/types/compliance';
import type { Database as DatabaseSchema } from '@/types/database';

type PropertyRow = Pick<
  DatabaseSchema['public']['Tables']['properties']['Row'],
  'id' | 'borough' | 'borough_code' | 'bin' | 'building_id' | 'total_units'
>;
type BuildingRow = Pick<
  DatabaseSchema['public']['Tables']['buildings']['Row'],
  | 'id'
  | 'borough_code'
  | 'occupancy_group'
  | 'occupancy_description'
  | 'is_one_two_family'
  | 'is_private_residence_building'
  | 'residential_units'
>;
type AssetRow = Pick<
  DatabaseSchema['public']['Tables']['compliance_assets']['Row'],
  | 'id'
  | 'property_id'
  | 'asset_type'
  | 'external_source'
  | 'active'
  | 'metadata'
  | 'device_category'
  | 'device_technology'
  | 'device_subtype'
  | 'is_private_residence'
>;
type CriteriaOverride = ComplianceProgram['criteria'] | null | undefined;

const dwellingUnitsFromBuilding = (building: BuildingRow | null | undefined): number | null => {
  if (!building) return null;
  if (typeof building.residential_units === 'number') return building.residential_units;
  return null;
};

async function runPreview(
  request: NextRequest,
  programId: string,
  criteriaOverride?: CriteriaOverride,
) {
  try {
    const rate = await checkRateLimit(request);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (membershipError || !membership?.org_id) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 400 });
    }

    const orgId = membership.org_id;

    const { data: program, error: programError } = await supabaseAdmin
      .from('compliance_programs')
      .select('id, applies_to, criteria, override_fields')
      .eq('id', programId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    // Load properties with minimal fields for filtering
    const { data: properties, error: propertiesError } = await supabaseAdmin
      .from('properties')
      .select('id, borough, borough_code, bin, building_id, total_units')
      .eq('org_id', orgId);

    if (propertiesError) {
      logger.error({ error: propertiesError, orgId }, 'Failed to fetch properties for preview');
      return NextResponse.json({ error: 'Failed to fetch properties' }, { status: 500 });
    }

    const programWithCriteria: Pick<ComplianceProgram, 'applies_to' | 'criteria' | 'override_fields'> = {
      applies_to: program.applies_to as ComplianceProgram['applies_to'],
      criteria: (criteriaOverride ?? program.criteria ?? null) as ComplianceProgram['criteria'] | null,
      override_fields: (program.override_fields ?? {}) as ComplianceProgram['override_fields'],
    };

    // Load assets so criteria rows can be evaluated regardless of scope
    const { data: assetRows, error: assetsError } = await supabaseAdmin
      .from('compliance_assets')
      .select(
        'id, property_id, asset_type, external_source, active, metadata, device_category, device_technology, device_subtype, is_private_residence',
      )
      .eq('org_id', orgId);

    if (assetsError) {
      logger.error({ error: assetsError, orgId }, 'Failed to fetch assets for preview');
      return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }
    const assets: AssetRow[] = assetRows || [];

    // Enrich properties with building metadata
    const propertyRows: PropertyRow[] = properties || [];
    const buildingIds = Array.from(
      new Set<string>(
        propertyRows
          .map((p) => p.building_id as string | null)
          .filter((id: string | null): id is string => Boolean(id)),
      ),
    );
    let buildings: BuildingRow[] = [];
    if (buildingIds.length > 0) {
      const { data: buildingRows, error: buildingError } = await supabaseAdmin
        .from('buildings')
        .select(
          'id, borough_code, occupancy_group, occupancy_description, is_one_two_family, is_private_residence_building, residential_units',
        )
        .in('id', buildingIds);
      if (buildingError) {
        logger.warn(
          { error: buildingError, orgId },
          'Failed to fetch building metadata for preview',
        );
      } else {
        buildings =
          buildingRows?.map((b) => ({
            ...b,
            borough_code:
              typeof b.borough_code === 'number'
                ? String(b.borough_code)
                : b.borough_code ?? null,
          })) || [];
      }
    }
    const buildingMap = new Map(
      buildings.map((b) => [
        b.id,
        {
          ...b,
          residential_units: dwellingUnitsFromBuilding(b),
        },
      ]),
    );
    const hydratedProperties = propertyRows.map((p) => {
      const building = p.building_id ? buildingMap.get(p.building_id) : null;
      const rawBorough = p.borough_code;
      const boroughCode =
        typeof rawBorough === 'number'
          ? rawBorough
          : rawBorough
            ? Number(rawBorough)
            : null;
      const totalUnitsRaw = p.total_units;
      return {
        ...p,
        occupancy_group: building?.occupancy_group || null,
        occupancy_description: building?.occupancy_description || null,
        is_one_two_family: building?.is_one_two_family ?? null,
        is_private_residence_building: building?.is_private_residence_building ?? null,
        residential_units: building?.residential_units ?? null,
        borough_code: boroughCode ?? (building?.borough_code as number | null) ?? null,
        property_total_units:
          typeof totalUnitsRaw === 'number'
            ? totalUnitsRaw
            : totalUnitsRaw
              ? Number(totalUnitsRaw)
              : null,
      };
    });

    const propertyMap = new Map(
      hydratedProperties.map((p) => [p.id, p]),
    );

    let matchedProperties = 0;
    let matchedAssets = 0;

    for (const property of hydratedProperties || []) {
      if (programTargetsProperty(programWithCriteria, property)) matchedProperties++;
    }

    for (const asset of assets) {
      const prop = propertyMap.get(asset.property_id) || null;
      if (programTargetsAsset(programWithCriteria as any, asset as any, prop as any)) matchedAssets++;
    }

    return NextResponse.json({
      program_id: programId,
      matched_properties: matchedProperties,
      matched_assets: matchedAssets,
      total_properties: properties?.length || 0,
      total_assets: assets.length,
    });
  } catch (error) {
    logger.error({ error }, 'Error in program preview API');
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> },
) {
  const { programId } = await params;
  return runPreview(request, programId);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> },
) {
  const { programId } = await params;
  const body = await request.json().catch(() => ({}));
  const criteria = body.criteria ? sanitizeProgramCriteria(body.criteria) : undefined;
  return runPreview(request, programId, criteria);
}
