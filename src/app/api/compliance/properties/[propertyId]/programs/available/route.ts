import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ComplianceService } from '@/lib/compliance-service';
import {
  canonicalAssetType,
  programTargetsAsset,
  programTargetsProperty,
} from '@/lib/compliance-programs';
import type {
  ComplianceAssetType,
  ComplianceDeviceCategory,
  ComplianceProgram,
  CompliancePropertyProgramOverride,
} from '@/types/compliance';
import type { Json } from '@/types/database';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';

type PropertyMeta = {
  id: string;
  borough: string | null;
  borough_code: number | null;
  bin: string | null;
  occupancy_group?: string | null;
  occupancy_description?: string | null;
  is_one_two_family?: boolean | null;
  is_private_residence_building?: boolean | null;
  residential_units?: number | null;
  property_total_units?: number | null;
};

type PropertyRow = PropertyMeta & {
  org_id: string;
  building_id: string | null;
  total_units: number | null;
};

type BuildingRow = {
  id: string;
  borough_code: number | null;
  occupancy_group: string | null;
  occupancy_description: string | null;
  is_one_two_family: boolean | null;
  is_private_residence_building: boolean | null;
  residential_units: number | null;
};

type AssetMeta = {
  id: string;
  property_id: string;
  asset_type: ComplianceAssetType;
  external_source: string | null;
  active: boolean;
  metadata: Json | null;
  device_category: ComplianceDeviceCategory | null;
  device_technology: string | null;
  device_subtype: string | null;
  is_private_residence: boolean | null;
};

type AvailableProgram = ComplianceProgram & {
  suppressed?: boolean;
  matches_criteria?: boolean;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> },
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

    const { propertyId: propertySlug } = await params;
    const { internalId: propertyId } = await resolvePropertyIdentifier(propertySlug);

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

    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select(
        'id, org_id, borough, borough_code, bin, building_id, total_units',
      )
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const propertyRow = property as PropertyRow;
    const buildingId = propertyRow.building_id as string | null;
    const buildingPromise = buildingId
      ? supabaseAdmin
          .from('buildings')
          .select(
            'id, borough_code, occupancy_group, occupancy_description, is_one_two_family, is_private_residence_building, residential_units',
          )
          .eq('id', buildingId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    const [programsResp, overridesResp, assets, buildingResp] = await Promise.all([
      supabaseAdmin.from('compliance_programs').select('*').eq('org_id', orgId),
      supabaseAdmin
        .from('compliance_property_program_overrides')
        .select('program_id, is_assigned')
        .eq('org_id', orgId)
        .eq('property_id', propertyId),
      ComplianceService.getAssetsByProperty(propertyId, orgId),
      buildingPromise,
    ]);

    if (programsResp.error) {
      logger.error({ error: programsResp.error, propertyId, orgId }, 'Failed to load programs');
      return NextResponse.json({ error: 'Failed to load programs' }, { status: 500 });
    }

    if (overridesResp.error) {
      logger.error(
        { error: overridesResp.error, propertyId, orgId },
        'Failed to load program overrides',
      );
      return NextResponse.json({ error: 'Failed to load programs' }, { status: 500 });
    }

    if (buildingResp && buildingResp.error) {
      logger.warn(
        { error: buildingResp.error, propertyId, orgId },
        'Failed to load building metadata for available programs',
      );
    }

    const buildingData = (buildingResp?.data || null) as BuildingRow | null;

    const propertyMeta: PropertyMeta = {
      id: propertyRow.id as string,
      borough: propertyRow.borough as string | null,
      borough_code: (propertyRow.borough_code ??
        buildingData?.borough_code) as number | null,
      bin: propertyRow.bin as string | null,
      occupancy_group: buildingData?.occupancy_group || null,
      occupancy_description: buildingData?.occupancy_description || null,
      is_one_two_family: buildingData?.is_one_two_family ?? null,
      is_private_residence_building: buildingData?.is_private_residence_building ?? null,
      residential_units: buildingData?.residential_units ?? null,
      property_total_units: propertyRow.total_units ?? null,
    };

    const assetMetas: AssetMeta[] = Array.isArray(assets)
      ? (assets as AssetMeta[]).map((asset) => {
          const deviceCategory =
            typeof asset.device_category === 'string'
              ? (asset.device_category as ComplianceDeviceCategory)
              : null;
          const normalizedAssetType =
            (canonicalAssetType(asset) as ComplianceAssetType | null) ??
            (typeof asset.asset_type === 'string'
              ? (asset.asset_type as ComplianceAssetType)
              : null) ??
            'other';
          const metadata = (asset.metadata ?? {}) as Json;
          return {
            id: asset.id as string,
            property_id: asset.property_id as string,
            asset_type: normalizedAssetType,
            external_source: asset.external_source as string | null,
            active: asset.active !== false,
            metadata,
            device_category: deviceCategory,
            device_technology: asset.device_technology as string | null,
            device_subtype: asset.device_subtype as string | null,
            is_private_residence: asset.is_private_residence as boolean | null,
          };
        })
      : [];

    const overrides = (overridesResp.data || []) as CompliancePropertyProgramOverride[];
    const assignedProgramIds = new Set(
      overrides
        .filter((override) => override.is_assigned !== false)
        .map((override) => override.program_id as string),
    );
    const suppressedProgramIds = new Set(
      overrides
        .filter((override) => override.is_assigned === false)
        .map((override) => override.program_id as string),
    );

    const programs = (programsResp.data || []).map((program) => ({
      ...(program as ComplianceProgram),
      criteria: ((program as ComplianceProgram).criteria as ComplianceProgram['criteria']) ?? null,
      override_fields:
        ((program as ComplianceProgram).override_fields as ComplianceProgram['override_fields']) ??
        null,
    })) as ComplianceProgram[];

    const availablePrograms: AvailableProgram[] = programs
      .filter((program: ComplianceProgram) => !assignedProgramIds.has(program.id))
      .map((program: ComplianceProgram) => {
        const suppressed = suppressedProgramIds.has(program.id);
        const overrideFields =
          (program as ComplianceProgram & { override_fields?: Record<string, unknown> })
            .override_fields || {};
        const criteriaRowsCandidate =
          (overrideFields as Record<string, unknown> | undefined)?.criteria_rows ??
          (overrideFields as Record<string, unknown> | undefined)?.criteriaRows;
        const hasDefinedCriteriaRows = Array.isArray(criteriaRowsCandidate);
        const criteriaRowsEmpty = hasDefinedCriteriaRows && (criteriaRowsCandidate as unknown[]).length === 0;

        const matchesProperty = criteriaRowsEmpty
          ? false
          : programTargetsProperty(program, propertyMeta);
        const matchesAssets = criteriaRowsEmpty
          ? false
          : assetMetas.some((asset) => programTargetsAsset(program, asset, propertyMeta));
        const matchesCriteria = matchesProperty || matchesAssets;

        return {
          ...program,
          suppressed,
          matches_criteria: matchesCriteria,
        };
      });

    return NextResponse.json({ programs: availablePrograms });
  } catch (error) {
    logger.error({ error }, 'Error listing available programs for property');
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
