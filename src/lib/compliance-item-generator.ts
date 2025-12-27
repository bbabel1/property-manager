/**
 * Compliance Item Generator
 *
 * Service to generate compliance_items based on compliance_programs and frequency.
 * Uses timezone-aware period calculations, respects lead_time_days, and uses
 * unique index to guard against race conditions.
 */

import { supabaseAdmin } from './db';
import { logger } from './logger';
import type {
  ComplianceItemInsert,
  ComplianceItemGenerationResponse,
  ComplianceProgram,
  ComplianceDeviceCategory,
  ComplianceAssetType,
  CompliancePropertyProgramOverride,
} from '@/types/compliance';
import type { Database, Json } from '@/types/database';
import {
  canonicalAssetType,
  programTargetsAsset,
  programTargetsProperty,
} from './compliance-programs';
type AssetMetaParam = NonNullable<Parameters<typeof programTargetsAsset>[1]>;

type PropertyRow = Pick<
  Database['public']['Tables']['properties']['Row'],
  'id' | 'borough' | 'borough_code' | 'bin' | 'building_id' | 'total_units'
>;

type BuildingRow = Pick<
  Database['public']['Tables']['buildings']['Row'],
  | 'borough_code'
  | 'occupancy_group'
  | 'occupancy_description'
  | 'is_one_two_family'
  | 'is_private_residence_building'
  | 'residential_units'
>;

type PropertyMeta = {
  id: string;
  borough: string | null;
  borough_code?: number | null;
  bin: string | null;
  occupancy_group?: string | null;
  occupancy_description?: string | null;
  is_one_two_family?: boolean | null;
  is_private_residence_building?: boolean | null;
  residential_units?: number | null;
  property_total_units?: number | null;
};

type ComplianceAssetRow = Database['public']['Tables']['compliance_assets']['Row'];

type ProgramOverrideFields = {
  criteria_rows?: unknown;
  criteriaRows?: unknown;
  due_date_value?: string;
  due_date?: string;
};

const normalizePressureType = (value: unknown): 'low_pressure' | 'high_pressure' | null => {
  if (!value) return null;
  const str = String(value).toLowerCase();
  if (str.includes('low')) return 'low_pressure';
  if (str.includes('high')) return 'high_pressure';
  return null;
};

const assetPressureType = (
  asset: { metadata?: Json | null; pressure_type?: unknown } | null | undefined,
): 'low_pressure' | 'high_pressure' | null => {
  if (!asset) return null;
  const meta = (asset.metadata ?? {}) as Record<string, unknown>;
  const candidates = [
    meta['pressure_type'],
    meta['pressuretype'],
    (asset as { pressure_type?: unknown }).pressure_type,
  ];
  for (const candidate of candidates) {
    const norm = normalizePressureType(candidate);
    if (norm) return norm;
  }
  return null;
};

const dwellingUnitsFromBuilding = (building: BuildingRow | null | undefined): number | null => {
  if (!building) return null;
  if (typeof building.residential_units === 'number') return building.residential_units;
  return null;
};

const buildPropertyMeta = (
  propertyRow: PropertyRow | null,
  buildingRow?: BuildingRow | null,
): PropertyMeta | null => {
  if (!propertyRow) return null;
  const boroughCodeRaw = propertyRow.borough_code ?? buildingRow?.borough_code ?? null;
  const borough_code =
    typeof boroughCodeRaw === 'string'
      ? Number.isNaN(Number(boroughCodeRaw))
        ? null
        : Number(boroughCodeRaw)
      : boroughCodeRaw ?? null;
  const meta: PropertyMeta = {
    id: propertyRow.id,
    borough: propertyRow.borough ?? null,
    borough_code,
    bin: propertyRow.bin ?? null,
    property_total_units: propertyRow.total_units ?? null,
  };

  if (buildingRow) {
    const buildingBoroughCode =
      typeof buildingRow.borough_code === 'string'
        ? Number.isNaN(Number(buildingRow.borough_code))
          ? null
          : Number(buildingRow.borough_code)
        : buildingRow.borough_code ?? meta.borough_code ?? null;
    meta.borough_code = buildingBoroughCode ?? meta.borough_code ?? null;
    meta.occupancy_group = buildingRow.occupancy_group ?? null;
    meta.occupancy_description = buildingRow.occupancy_description ?? null;
    meta.is_one_two_family = buildingRow.is_one_two_family ?? null;
    meta.is_private_residence_building = buildingRow.is_private_residence_building ?? null;
    meta.residential_units = dwellingUnitsFromBuilding(buildingRow);
  }

  return meta;
};

const fetchPropertyMeta = async (propertyId: string): Promise<PropertyMeta | null> => {
  const { data: propertyRow } = await supabaseAdmin
    .from('properties')
    .select('id, borough, borough_code, bin, building_id, total_units')
    .eq('id', propertyId)
    .maybeSingle();

  if (!propertyRow) return null;
  const typedProperty = propertyRow as PropertyRow;

  let buildingRow: BuildingRow | null = null;
  const buildingId = typedProperty.building_id ?? null;
  if (buildingId) {
    const { data: buildingData } = await supabaseAdmin
      .from('buildings')
      .select(
        'id, borough_code, occupancy_group, occupancy_description, is_one_two_family, is_private_residence_building, residential_units',
      )
      .eq('id', buildingId)
      .maybeSingle();
    buildingRow = (buildingData as BuildingRow | null) ?? null;
  }

  return buildPropertyMeta(typedProperty, buildingRow);
};

const parseDueDateOverride = (
  value: unknown,
): { month: number; day: number } | null => {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split('-');
  if (parts.length < 3) return null;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { month, day };
};

const applyOverrideDueDate = (
  period: { period_start: string; period_end: string; due_date: string },
  override: { month: number; day: number } | null,
): { period_start: string; period_end: string; due_date: string } => {
  if (!override) return period;

  const start = new Date(`${period.period_start}T00:00:00Z`);
  const end = new Date(`${period.period_end}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return period;

  const { month, day } = override;
  let candidate = new Date(Date.UTC(end.getUTCFullYear(), month - 1, day));

  // If the candidate is before the period start, roll to the next year.
  if (candidate < start) {
    candidate = new Date(Date.UTC(end.getUTCFullYear() + 1, month - 1, day));
  }

  // Clamp to period end if we overshoot.
  if (candidate > end) {
    candidate = end;
  }

  const iso = candidate.toISOString().split('T')[0];
  return { ...period, due_date: iso };
};

export class ComplianceItemGenerator {
  /**
   * Generate compliance items for a property
   */
  async generateItemsForProperty(
    propertyId: string,
    orgId: string,
    periodsAhead = 12,
  ): Promise<ComplianceItemGenerationResponse> {
    try {
      // Get all enabled compliance programs for this org
      const { data: programs, error: programsError } = await supabaseAdmin
        .from('compliance_programs')
        .select('*')
        .eq('org_id', orgId);

      if (programsError) {
        logger.error(
          { error: programsError, propertyId, orgId },
          'Failed to fetch compliance programs',
        );
        throw programsError;
      }

      if (!programs || programs.length === 0) {
        logger.info({ propertyId, orgId }, 'No enabled compliance programs found');
        return { success: true, items_created: 0, items_skipped: 0 };
      }

      let itemsCreated = 0;
      let itemsSkipped = 0;
      const errors: string[] = [];

      // Property metadata for criteria evaluation
      const propertyMeta = await fetchPropertyMeta(propertyId);

      const overrides = await this.getPropertyProgramOverrides(propertyId, orgId);

      // Generate items for each program (property-scoped or both)
      for (const program of programs) {
        const programRecord = program as ComplianceProgram;
        try {
          const override = overrides.get(program.id);
          const suppressed = override?.is_assigned === false;
          if (suppressed) continue;

          const effectiveEnabled =
            typeof override?.is_enabled === 'boolean'
              ? override.is_enabled
              : programRecord.is_enabled;
          if (!effectiveEnabled) continue;

          const assigned = override?.is_assigned === true;
          const programOverrideFields = (programRecord.override_fields ?? {}) as ProgramOverrideFields;
          const criteriaRows =
            programOverrideFields.criteria_rows ?? programOverrideFields.criteriaRows ?? null;
          const hasDefinedCriteriaRows = Array.isArray(criteriaRows);
          const criteriaRowsEmpty = hasDefinedCriteriaRows && criteriaRows.length === 0;
          const matchesProperty = criteriaRowsEmpty
            ? false
            : programTargetsProperty(programRecord, propertyMeta);

          // Skip asset-only programs in property-level generation
          if (programRecord.applies_to === 'asset') continue;
          if (!assigned && !matchesProperty) continue;

          const result = await this.generateItemsForProgram(
            programRecord.id,
            propertyId,
            undefined, // asset_id - will be determined by program.applies_to
            orgId,
            periodsAhead,
          );
          itemsCreated += result.items_created;
          itemsSkipped += result.items_skipped;
          if (result.errors) {
            errors.push(...result.errors);
          }
        } catch (error) {
          logger.error(
            { error, programId: program.id, propertyId, orgId },
            'Error generating items for program',
          );
          errors.push(
            `Program ${programRecord.code}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`,
          );
        }
      }

      return {
        success: errors.length === 0,
        items_created: itemsCreated,
        items_skipped: itemsSkipped,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      logger.error({ error, propertyId, orgId }, 'Error in generateItemsForProperty');
      throw error;
    }
  }

  /**
   * Generate compliance items for a specific asset
   */
  async generateItemsForAsset(
    assetId: string,
    orgId: string,
    periodsAhead = 12,
  ): Promise<ComplianceItemGenerationResponse> {
    try {
      // Get asset details
      const { data: asset, error: assetError } = await supabaseAdmin
        .from('compliance_assets')
        .select(
          'id, property_id, asset_type, external_source, active, metadata, device_category, device_technology, device_subtype, is_private_residence',
        )
        .eq('id', assetId)
        .eq('org_id', orgId)
        .single();

      if (assetError || !asset) {
        throw new Error(`Asset not found: ${assetId}`);
      }

      const assetType = asset.asset_type ?? null;

      // Get programs that apply to this asset type
      const { data: programs, error: programsError } = await supabaseAdmin
        .from('compliance_programs')
        .select('*')
        .eq('org_id', orgId);

      if (programsError) {
        logger.error(
          { error: programsError, assetId, orgId },
          'Failed to fetch compliance programs',
        );
        throw programsError;
      }

      if (!programs || programs.length === 0) {
        return { success: true, items_created: 0, items_skipped: 0 };
      }

      // Fetch property meta for criteria checks
      const propertyMeta = await fetchPropertyMeta(asset.property_id);

      const overrides = await this.getPropertyProgramOverrides(
        asset.property_id,
        orgId,
      );

      const deviceCategory: ComplianceDeviceCategory | null =
        typeof asset.device_category === 'string'
          ? ((asset.device_category as ComplianceDeviceCategory) ?? null)
          : null;
      const assetMetaBase: AssetMetaParam = {
        id: asset.id,
        property_id: asset.property_id,
        asset_type: (asset.asset_type as ComplianceAssetType) ?? 'other',
        external_source: asset.external_source,
        active: asset.active,
        device_category: deviceCategory ?? undefined,
        device_technology: asset.device_technology ?? null,
        device_subtype: asset.device_subtype ?? null,
        is_private_residence: asset.is_private_residence ?? null,
        metadata: (asset.metadata ?? null) as Json | null,
      };
      const normalizedAssetType: ComplianceAssetType =
        canonicalAssetType(assetMetaBase) ||
        ((assetType || '').toLowerCase() as ComplianceAssetType) ||
        assetMetaBase.asset_type;
      const assetMetaForGuard: AssetMetaParam = {
        ...assetMetaBase,
        asset_type: normalizedAssetType,
      };

      // Filter out programs that do not match this asset type (prevent boilers/facades/etc. from being assigned to elevators)
      const typeGuards: Record<string, (code: string) => boolean> = {
        elevator: (code) => code.startsWith('NYC_ELV'),
        boiler: (code) => code.startsWith('NYC_BOILER'),
        sprinkler: (code) => code.startsWith('NYC_SPRINKLER'),
        gas_piping: (code) => code.startsWith('NYC_GAS'),
        facade: (code) => code.startsWith('NYC_FACADE'),
      };
      const normalizedType = assetMetaForGuard.asset_type;
      const pressureType = assetPressureType(assetMetaForGuard);
      const guard = typeGuards[normalizedType];

      // Clean up mismatched boiler programs before generating new items to avoid duplicates (LP vs HP).
      if (normalizedType === 'boiler' && pressureType && assetId) {
        const oppositeCode =
          pressureType === 'low_pressure' ? 'NYC_BOILER_HP_ANNUAL' : 'NYC_BOILER_LP_ANNUAL';
        const oppositeProgram = programs.find((p) => p.code === oppositeCode);
        if (oppositeProgram) {
          await supabaseAdmin
            .from('compliance_items')
            .delete()
            .eq('org_id', orgId)
            .eq('property_id', asset.property_id)
            .eq('asset_id', assetId)
            .eq('program_id', oppositeProgram.id);
        }
      }

      const filteredPrograms = (
        guard ? programs.filter((p) => guard(p.code || '')) : programs
      ).filter((p) => {
        const override = overrides.get(p.id);
        if (override?.is_assigned === false) return false;

        const effectiveEnabled =
          typeof override?.is_enabled === 'boolean' ? override.is_enabled : p.is_enabled;
        if (effectiveEnabled !== true) return false;

        const assigned = override?.is_assigned === true;
        const programRecord = p as ComplianceProgram;
        const programOverrideFields = (programRecord.override_fields ?? {}) as ProgramOverrideFields;
        const criteriaRows =
          programOverrideFields.criteria_rows ?? programOverrideFields.criteriaRows ?? null;
        const hasDefinedCriteriaRows = Array.isArray(criteriaRows);
        const criteriaRowsEmpty = hasDefinedCriteriaRows && criteriaRows.length === 0;
        // Hard stop: do not assign both LP/HP boiler programs. If we know the pressure type, require a match.
        const programPressure =
          programRecord.criteria?.asset_filters?.pressure_type ||
          (programRecord.code === 'NYC_BOILER_LP_ANNUAL'
            ? 'low_pressure'
            : programRecord.code === 'NYC_BOILER_HP_ANNUAL'
              ? 'high_pressure'
              : null);
        if (normalizedType === 'boiler' && programPressure) {
          if (!pressureType) return false; // Unknown pressure → skip rather than double-assign
          if (pressureType !== programPressure) return false;
        }
        if (assigned) return true;
        if (criteriaRowsEmpty) return false;
        return programTargetsAsset(
          programRecord,
          assetMetaForGuard as unknown as AssetMetaParam,
          propertyMeta,
        );
      });

      let itemsCreated = 0;
      let itemsSkipped = 0;
      const errors: string[] = [];

      for (const program of filteredPrograms) {
        try {
          const result = await this.generateItemsForProgram(
            program.id,
            asset.property_id,
            assetId,
            orgId,
            periodsAhead,
          );
          itemsCreated += result.items_created;
          itemsSkipped += result.items_skipped;
          if (result.errors) {
            errors.push(...result.errors);
          }
        } catch (error) {
          logger.error(
            { error, programId: program.id, assetId, orgId },
            'Error generating items for program',
          );
          errors.push(
            `Program ${program.code}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      return {
        success: errors.length === 0,
        items_created: itemsCreated,
        items_skipped: itemsSkipped,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      logger.error({ error, assetId, orgId }, 'Error in generateItemsForAsset');
      throw error;
    }
  }

  /**
   * Generate compliance items for a specific program
   */
  async generateItemsForProgram(
    programId: string,
    propertyId: string,
    assetId: string | undefined,
    orgId: string,
    periodsAhead = 12,
  ): Promise<{ items_created: number; items_skipped: number; errors?: string[] }> {
    try {
      // Get program details
      const { data: program, error: programError } = await supabaseAdmin
        .from('compliance_programs')
        .select('*')
        .eq('id', programId)
        .eq('org_id', orgId)
        .single();

      if (programError || !program) {
        throw new Error(`Program not found: ${programId}`);
      }

      // Verify applies_to matches
      if (assetId && program.applies_to === 'property') {
        // Skip - this program doesn't apply to assets
        return { items_created: 0, items_skipped: 0 };
      }

      if (!assetId && program.applies_to === 'asset') {
        // Skip - this program requires an asset
        return { items_created: 0, items_skipped: 0 };
      }

      // Get property org_id to ensure consistency
      const { data: property, error: propertyError } = await supabaseAdmin
        .from('properties')
        .select('org_id, borough, borough_code, bin, building_id, total_units')
        .eq('id', propertyId)
        .single();

      if (propertyError || !property) {
        throw new Error(`Property not found: ${propertyId}`);
      }

      if (property.org_id !== orgId) {
        throw new Error(`Property org_id mismatch: ${property.org_id} !== ${orgId}`);
      }

      const programRecord = program as ComplianceProgram;
      const overrides = await this.getPropertyProgramOverrides(propertyId, orgId);
      const override = overrides.get(programId);
      if (override?.is_assigned === false) {
        return { items_created: 0, items_skipped: 0 };
      }

      const effectiveEnabled =
        typeof override?.is_enabled === 'boolean' ? override.is_enabled : programRecord.is_enabled;
      if (!effectiveEnabled) {
        return { items_created: 0, items_skipped: 0 };
      }

      const propertyMeta = await fetchPropertyMeta(propertyId);

      type ProgramAssetMeta = NonNullable<Parameters<typeof programTargetsAsset>[1]>;

      let assetMeta: ProgramAssetMeta | null = null;
      if (assetId) {
        const { data: assetRow, error: assetRowError } = await supabaseAdmin
          .from('compliance_assets')
          .select(
            'id, property_id, asset_type, external_source, active, metadata, device_category, device_technology, device_subtype, is_private_residence',
          )
          .eq('id', assetId)
          .eq('org_id', orgId)
          .single();

        if (assetRowError || !assetRow) {
          throw new Error(`Asset not found for criteria evaluation: ${assetId}`);
        }
        const typedAsset = assetRow as ComplianceAssetRow;
        const deviceCategoryNormalized =
          typeof typedAsset.device_category === 'string'
            ? (typedAsset.device_category as ComplianceDeviceCategory)
            : null;
        assetMeta = {
          id: typedAsset.id,
          property_id: typedAsset.property_id,
          asset_type: (typedAsset.asset_type as ComplianceAssetType) ?? ('other' as ComplianceAssetType),
          external_source: typedAsset.external_source,
          active: typedAsset.active,
          device_category: deviceCategoryNormalized,
          device_technology: typedAsset.device_technology,
          device_subtype: typedAsset.device_subtype,
          is_private_residence: typedAsset.is_private_residence,
          metadata: (typedAsset.metadata ?? null) as Json | null,
        };
      }

      const assigned = override?.is_assigned === true;
      const programOverrideFields = (programRecord.override_fields ?? {}) as ProgramOverrideFields;
      const criteriaRows =
        programOverrideFields.criteria_rows ?? programOverrideFields.criteriaRows ?? null;
      const hasDefinedCriteriaRows = Array.isArray(criteriaRows);
      const criteriaRowsEmpty = hasDefinedCriteriaRows && criteriaRows.length === 0;

      if (!assigned && criteriaRowsEmpty) {
        return { items_created: 0, items_skipped: 0 };
      }

      if (!assetId && !assigned && !programTargetsProperty(programRecord, propertyMeta)) {
        return { items_created: 0, items_skipped: 0 };
      }

      if (assetId && !assigned && !programTargetsAsset(programRecord, assetMeta, propertyMeta)) {
        return { items_created: 0, items_skipped: 0 };
      }

      // Calculate periods (timezone-aware)
      const now = new Date();
      const timezone = 'America/New_York'; // NYC timezone
      const horizon = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
      horizon.setFullYear(horizon.getFullYear() + 5);

      // Clean up any items beyond horizon for this target before creating new ones
      const horizonStr = horizon.toISOString().split('T')[0];
      const deleteQuery = supabaseAdmin
        .from('compliance_items')
        .delete()
        .eq('program_id', programId)
        .eq('property_id', propertyId)
        .gt('due_date', horizonStr);
      if (assetId) {
        deleteQuery.eq('asset_id', assetId);
      } else {
        deleteQuery.is('asset_id', null);
      }
      await deleteQuery;

      const periods =
        programRecord.code === 'NYC_HPD_REGISTRATION'
          ? this.calculateHpdRegistrationPeriods(periodsAhead, timezone, horizon)
          : this.calculatePeriods(
              programRecord.frequency_months,
              programRecord.lead_time_days,
              periodsAhead,
              timezone,
              horizon,
            );
      const overrideDueFields = (programRecord.override_fields ?? {}) as ProgramOverrideFields;
      const overrideSource =
        overrideDueFields.due_date_value ?? overrideDueFields.due_date ?? null;
      const dueDateOverride = parseDueDateOverride(overrideSource);
      const normalizedPeriods = periods.map((period) =>
        applyOverrideDueDate(period, dueDateOverride),
      );

      let itemsCreated = 0;
      let itemsSkipped = 0;
      const errors: string[] = [];

      for (const period of normalizedPeriods) {
        try {
          // Check if item already exists (unique index will prevent duplicates)
          let existingQuery = supabaseAdmin
            .from('compliance_items')
            .select('id, due_date')
            .eq('program_id', programId)
            .eq('property_id', propertyId)
            .eq('period_start', period.period_start)
            .eq('period_end', period.period_end);
          if (assetId) {
            existingQuery = existingQuery.eq('asset_id', assetId);
          } else {
            existingQuery = existingQuery.is('asset_id', null);
          }
          const { data: existing, error: checkError } = await existingQuery.maybeSingle();

          if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
          }

          if (existing) {
            const existingItem = existing as { id: string; due_date: string | null };
            if (existingItem.due_date !== period.due_date) {
              await supabaseAdmin
                .from('compliance_items')
                .update({ due_date: period.due_date })
                .eq('id', existingItem.id);
            }
            itemsSkipped++;
            continue;
          }

          // Create new item
          const itemData: ComplianceItemInsert = {
            property_id: propertyId,
            asset_id: assetId || null,
          program_id: programId,
          org_id: orgId,
          period_start: period.period_start,
          period_end: period.period_end,
          due_date: period.due_date,
          status: 'not_started',
          source: 'manual',
          defect_flag: false,
          result: null,
          external_tracking_number: null,
          notes: null,
          next_action: null,
          primary_work_order_id: null,
        };

          const { error: insertError } = await supabaseAdmin
            .from('compliance_items')
            .insert(itemData);

          if (insertError) {
            // Check if it's a unique constraint violation (race condition)
            if (insertError.code === '23505') {
              itemsSkipped++;
              continue;
            }
            throw insertError;
          }

          itemsCreated++;
        } catch (error) {
          logger.error(
            { error, period, programId, propertyId, assetId },
            'Error creating compliance item',
          );
          errors.push(
            `Period ${period.period_start} to ${period.period_end}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      return {
        items_created: itemsCreated,
        items_skipped: itemsSkipped,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      logger.error(
        { error, programId, propertyId, assetId, orgId },
        'Error in generateItemsForProgram',
      );
      throw error;
    }
  }

  /**
   * Calculate compliance periods based on frequency and lead time
   * Timezone-aware to ensure consistent date calculations
   */
  private calculatePeriods(
    frequencyMonths: number,
    leadTimeDays: number,
    periodsAhead: number,
    timezone: string,
    horizonOverride?: Date,
  ): Array<{ period_start: string; period_end: string; due_date: string }> {
    if (frequencyMonths <= 0) return [];
    const periods: Array<{ period_start: string; period_end: string; due_date: string }> = [];

    // Get current date in NYC timezone
    const now = new Date();
    const nycDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const maxLookaheadYears = 5;
    const horizon = horizonOverride
      ? new Date(horizonOverride)
      : (() => {
          const h = new Date(nycDate);
          h.setFullYear(h.getFullYear() + maxLookaheadYears);
          return h;
        })();

    // Start from the beginning of the current month
    const startDate = new Date(nycDate.getFullYear(), nycDate.getMonth(), 1);

    for (let i = 0; i < periodsAhead; i++) {
      const periodStart = new Date(startDate);
      periodStart.setMonth(periodStart.getMonth() + i * frequencyMonths);

      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + frequencyMonths);
      periodEnd.setDate(periodEnd.getDate() - 1); // Last day of period

      // Due date is period_end minus lead_time_days
      const dueDate = new Date(periodEnd);
      dueDate.setDate(dueDate.getDate() - leadTimeDays);

      // Only include periods where due_date is in the future or recent past (last 30 days)
      const thirtyDaysAgo = new Date(nycDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (dueDate >= thirtyDaysAgo) {
        if (dueDate > horizon) {
          break;
        }
        periods.push({
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
        });
      }
    }

    return periods;
  }

  private calculateHpdRegistrationPeriods(
    periodsAhead: number,
    timezone: string,
    horizonOverride?: Date,
  ): Array<{ period_start: string; period_end: string; due_date: string }> {
    const periods: Array<{ period_start: string; period_end: string; due_date: string }> = [];
    const now = new Date();
    const nycDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const maxLookaheadYears = 5;
    const horizon = horizonOverride
      ? new Date(horizonOverride)
      : (() => {
          const h = new Date(nycDate);
          h.setFullYear(h.getFullYear() + maxLookaheadYears);
          return h;
        })();
    const thirtyDaysAgo = new Date(nycDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let year = nycDate.getFullYear() - 1; // Start one cycle back to catch recent due dates
    while (periods.length < periodsAhead) {
      const dueDate = new Date(Date.UTC(year, 8, 1)); // September 1 of the cycle year
      if (dueDate > horizon) break;
      if (dueDate >= thirtyDaysAgo) {
        const periodStart = new Date(Date.UTC(year - 1, 9, 1)); // October 1 of prior year
        const periodEnd = new Date(Date.UTC(year, 8, 30)); // September 30 of the cycle year
        periods.push({
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          due_date: dueDate.toISOString().split('T')[0],
        });
      }
      year += 1;
    }

    return periods;
  }

  private async getPropertyProgramOverrides(
    propertyId: string,
    orgId: string,
  ): Promise<Map<string, CompliancePropertyProgramOverride>> {
    try {
      const map = new Map<string, CompliancePropertyProgramOverride>();
      const { data, error } = await supabaseAdmin
        .from('compliance_property_program_overrides')
        .select(
          'id, org_id, property_id, program_id, is_enabled, is_assigned, assigned_at, assigned_by, created_at, updated_at',
        )
        .eq('property_id', propertyId)
        .eq('org_id', orgId);

      if (error) {
        throw error;
      }

      (data || []).forEach((row) => {
        map.set(row.program_id, row as CompliancePropertyProgramOverride);
      });

      return map;
    } catch (error) {
      logger.error({ error, propertyId, orgId }, 'Error loading program overrides for property');
      return new Map();
    }
  }
}
