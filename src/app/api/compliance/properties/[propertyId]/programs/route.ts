import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ComplianceService } from '@/lib/compliance-service';
import { ComplianceItemGenerator } from '@/lib/compliance-item-generator';
import {
  canonicalAssetType,
  programTargetsAsset,
  programTargetsProperty,
} from '@/lib/compliance-programs';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';
import type {
  ComplianceAssetType,
  ComplianceDeviceCategory,
  ComplianceProgram,
} from '@/types/compliance';
import type { Json } from '@/types/database';

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

export async function POST(
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
    const body = await request.json().catch(() => ({}));
    const programId = typeof body.program_id === 'string' ? body.program_id : '';
    const isEnabledInput =
      typeof body.is_enabled === 'boolean' ? body.is_enabled : (body.is_enabled === null ? null : undefined);

    if (!programId) {
      return NextResponse.json({ error: 'program_id is required' }, { status: 400 });
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

    const { data: program, error: programError } = await supabaseAdmin
      .from('compliance_programs')
      .select('*')
      .eq('id', programId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (programError || !program) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

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

    const [assets, buildingResp] = await Promise.all([
      ComplianceService.getAssetsByProperty(propertyId, orgId),
      buildingPromise,
    ]);

    if (buildingResp && buildingResp.error) {
      logger.warn(
        { error: buildingResp.error, propertyId, orgId },
        'Failed to load building metadata for program add',
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

    const typedProgram: Pick<ComplianceProgram, 'applies_to' | 'criteria' | 'override_fields'> = {
      applies_to: program.applies_to as ComplianceProgram['applies_to'],
      criteria: (program.criteria as unknown as ComplianceProgram['criteria']) ?? null,
      override_fields: (program.override_fields as unknown as ComplianceProgram['override_fields']) ?? null,
    };

    const overrideFields =
      (typedProgram as ComplianceProgram & { override_fields?: Record<string, unknown> })
        .override_fields || {};
    const criteriaRowsCandidate =
      (overrideFields as Record<string, unknown> | undefined)?.criteria_rows ??
      (overrideFields as Record<string, unknown> | undefined)?.criteriaRows;
    const hasDefinedCriteriaRows = Array.isArray(criteriaRowsCandidate);
    const criteriaRowsEmpty = hasDefinedCriteriaRows && (criteriaRowsCandidate as unknown[]).length === 0;

    const matchesProperty = criteriaRowsEmpty
      ? false
      : programTargetsProperty(typedProgram, propertyMeta);
    const matchesAssets = criteriaRowsEmpty
      ? false
      : assetMetas.some((asset) => programTargetsAsset(typedProgram, asset, propertyMeta));
    const matchesCriteria = matchesProperty || matchesAssets;

    const isEnabled = typeof isEnabledInput === 'boolean' ? isEnabledInput : true;

    const { data: override, error: overrideError } = await supabaseAdmin
      .from('compliance_property_program_overrides')
      .upsert(
        {
          org_id: orgId,
          property_id: propertyId,
          program_id: programId,
          is_enabled: isEnabled,
          is_assigned: true,
          assigned_at: new Date().toISOString(),
          assigned_by: user.id,
        },
        { onConflict: 'property_id,program_id' },
      )
      .select()
      .maybeSingle();

    if (overrideError) {
      logger.error(
        { error: overrideError, propertyId, programId, orgId },
        'Failed to save program override',
      );
      return NextResponse.json({ error: 'Failed to add program to property' }, { status: 500 });
    }

    const effective_is_enabled =
      typeof override?.is_enabled === 'boolean' ? override.is_enabled : program.is_enabled;

    if (effective_is_enabled) {
      try {
        const generator = new ComplianceItemGenerator();
        const tasks: Promise<unknown>[] = [];
        if (program.applies_to === 'property' || program.applies_to === 'both') {
          tasks.push(generator.generateItemsForProperty(propertyId, orgId, 12));
        }
        if ((program.applies_to === 'asset' || program.applies_to === 'both') && assetMetas.length) {
          const uniqueAssetIds = Array.from(new Set(assetMetas.map((asset) => asset.id)));
          tasks.push(
            Promise.all(
              uniqueAssetIds.map((assetId) =>
                generator.generateItemsForAsset(assetId as string, orgId, 12),
              ),
            ),
          );
        }
        if (tasks.length) {
          await Promise.all(tasks);
        }
      } catch (genErr) {
        logger.error(
          { error: genErr, propertyId, programId, orgId },
          'Failed to generate items after adding program',
        );
      }
    }

    const warning =
      !matchesCriteria && effective_is_enabled
        ? 'Program does not match applicability criteria for this property'
        : !program.is_enabled && effective_is_enabled
          ? 'This program is disabled globally but enabled for this property'
          : undefined;

    return NextResponse.json({
      override,
      program,
      matches_criteria: matchesCriteria,
      effective_is_enabled,
      warning,
    });
  } catch (error) {
    logger.error({ error }, 'Error adding property compliance program');
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
