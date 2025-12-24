/**
 * Property Compliance API Route
 *
 * GET /api/compliance/properties/[propertyId]
 *
 * Returns compliance data for a specific property
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { ComplianceService } from '@/lib/compliance-service';
import { supabaseAdmin } from '@/lib/db';
import { ComplianceItemGenerator } from '@/lib/compliance-item-generator';
import {
  canonicalAssetType,
  programTargetsAsset,
  programTargetsProperty,
} from '@/lib/compliance-programs';
import { resolvePropertyIdentifier } from '@/lib/public-id-utils';
import type {
  ComplianceAsset,
  ComplianceAssetType,
  ComplianceDeviceCategory,
  ComplianceProgram,
  CompliancePropertyProgramOverride,
  ComplianceItem,
  ComplianceEvent,
} from '@/types/compliance';
import type { Json } from '@/types/database';
import type { Database } from '@/types/database';

type StatusChip = 'on_track' | 'at_risk' | 'non_compliant';

function computeStatusChip(openViolations: number, overdueItems: number): StatusChip {
  if (openViolations > 0 || overdueItems > 0) {
    if (openViolations >= 3 || overdueItems >= 2) return 'non_compliant';
    return 'at_risk';
  }
  return 'on_track';
}

type AssetMeta = Pick<
  ComplianceAsset,
  | 'id'
  | 'property_id'
  | 'asset_type'
  | 'external_source'
  | 'active'
  | 'device_category'
  | 'device_technology'
  | 'device_subtype'
  | 'is_private_residence'
> & { metadata: Json | null; pressure_type: string | null };

type ProgramRow = ComplianceProgram & {
  template?: {
    id: string;
    code: string;
    jurisdiction: string;
    frequency_months: number;
    lead_time_days: number;
    applies_to: ComplianceProgram['applies_to'];
    severity_score: number;
  } | null;
};

type ComplianceItemWithProgram = ComplianceItem & {
  program?: { code?: string | null } | null;
};

type PropertyRow = Database['public']['Tables']['properties']['Row'];
type BuildingRow = Database['public']['Tables']['buildings']['Row'];
type AssetWithSchedule = ComplianceAsset & {
  last_inspection_at?: string | null;
  next_due?: string | null;
  upcoming_inspections?: number;
  pressure_type: string | null;
};

function normalizeEventResult(status?: string | null): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes('defect') || s.includes('reject') || s.includes('fail')) return 'fail';
  if (s.includes('pass') || s.includes('accept')) return 'pass';
  return status;
}

const ELEVATOR_PROGRAM_CODES = ['NYC_ELV_PERIODIC', 'NYC_ELV_CAT1', 'NYC_ELV_CAT5'];

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function computeHpdRegistrationDueDate(
  item: { due_date?: string | null; period_end?: string | null },
  registrationEndDate?: string | null,
): string | null {
  const anchor =
    (registrationEndDate ? parseDate(registrationEndDate) : null) ||
    parseDate(item.period_end || null) ||
    parseDate(item.due_date || null);
  if (!anchor) return null;
  const due = startOfMonth(anchor);
  return due.toISOString().split('T')[0];
}

function dateFromYear(value?: string | number | null): Date | null {
  if (value === null || value === undefined) return null;
  const year = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(year)) return null;
  return new Date(Date.UTC(year, 11, 31));
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function advanceToFuture(date: Date, frequencyMonths: number): Date {
  if (frequencyMonths <= 0) return date;
  const now = new Date();
  let cursor = addMonths(date, frequencyMonths);
  // keep advancing to the next cycle if the calculated due is already in the past
  while (cursor < now) {
    cursor = addMonths(cursor, frequencyMonths);
  }
  return cursor;
}

function normalizePressureType(value?: string | null): 'low_pressure' | 'high_pressure' | null {
  if (!value) return null;
  const s = String(value).toLowerCase();
  if (s.includes('low')) return 'low_pressure';
  if (s.includes('high')) return 'high_pressure';
  return null;
}

type AssetWithMetadata = Partial<ComplianceAsset> & {
  metadata?: Json | null;
  pressure_type?: string | null;
  pressuretype?: string | null;
};

function getBoilerPressure(asset: AssetWithMetadata | null | undefined): 'low_pressure' | 'high_pressure' | null {
  if (!asset) return null;
  const meta = (asset.metadata ?? {}) as Record<string, unknown>;
  const metaPressure =
    typeof meta.pressure_type === 'string'
      ? meta.pressure_type
      : typeof meta.pressuretype === 'string'
        ? meta.pressuretype
        : null;
  const assetPressure = typeof asset.pressure_type === 'string' ? asset.pressure_type : null;
  return normalizePressureType(metaPressure || assetPressure);
}

function categorizeElevatorEvent(
  inspectionType?: string | null,
): (typeof ELEVATOR_PROGRAM_CODES)[number] | null {
  if (!inspectionType) return null;
  const normalized = inspectionType.toLowerCase();
  if (
    normalized.includes('cat 5') ||
    normalized.includes('cat5') ||
    normalized.includes('category 5')
  )
    return 'NYC_ELV_CAT5';
  if (
    normalized.includes('cat 1') ||
    normalized.includes('cat1') ||
    normalized.includes('category 1')
  )
    return 'NYC_ELV_CAT1';
  if (normalized.includes('periodic') || normalized.includes('visual')) return 'NYC_ELV_PERIODIC';
  return null;
}

function computeElevatorSchedule(
  asset: AssetWithMetadata,
  events: Array<{
    asset_id?: string | null;
    inspection_type?: string | null;
    inspection_date?: string | null;
    filed_date?: string | null;
    created_at?: string | null;
  }>,
  programs: Array<{
    code: string;
    frequency_months: number;
    effective_is_enabled?: boolean;
    is_enabled?: boolean;
  }>,
): { lastInspection: Date | null; nextDue: Date | null } {
  const relevantEvents = events.filter((event) => event.asset_id === asset.id);
  const lastByCode: Record<string, Date | null> = {
    NYC_ELV_PERIODIC: null,
    NYC_ELV_CAT1: null,
    NYC_ELV_CAT5: null,
  };
  let lastInspection: Date | null = null;

  const updateLast = (code: string, candidate: Date | null) => {
    if (!candidate || !ELEVATOR_PROGRAM_CODES.includes(code)) return;
    const current = lastByCode[code] || null;
    if (!current || candidate > current) {
      lastByCode[code] = candidate;
    }
  };

  const updateOverall = (candidate: Date | null) => {
    if (!candidate) return;
    if (!lastInspection || candidate > lastInspection) {
      lastInspection = candidate;
    }
  };

  for (const event of relevantEvents) {
    const eventDate =
      parseDate(event.filed_date) ||
      parseDate(event.inspection_date) ||
      parseDate(event.created_at);
    updateOverall(eventDate);
    const bucket = categorizeElevatorEvent(event.inspection_type);
    if (bucket) {
      updateLast(bucket, eventDate);
    }
  }

  const meta = (asset?.metadata ?? {}) as Record<string, unknown>;
  const periodicLatest =
    typeof meta.periodic_latest_inspection === 'string' ? meta.periodic_latest_inspection : null;
  const periodicYear =
    typeof meta.periodic_report_year === 'string' || typeof meta.periodic_report_year === 'number'
      ? meta.periodic_report_year
      : null;
  const cat1Latest =
    typeof meta.cat1_latest_report_filed === 'string' ? meta.cat1_latest_report_filed : null;
  const cat1Year =
    typeof meta.cat1_report_year === 'string' || typeof meta.cat1_report_year === 'number'
      ? meta.cat1_report_year
      : null;
  const cat5Latest =
    typeof meta.cat5_latest_report_filed === 'string' ? meta.cat5_latest_report_filed : null;

  updateLast('NYC_ELV_PERIODIC', parseDate(periodicLatest) || dateFromYear(periodicYear));
  updateLast('NYC_ELV_CAT1', parseDate(cat1Latest) || dateFromYear(cat1Year));
  updateLast('NYC_ELV_CAT5', parseDate(cat5Latest));

  const dueCandidates: Date[] = [];
  for (const program of programs) {
    const enabled =
      typeof program.effective_is_enabled === 'boolean'
        ? program.effective_is_enabled
        : program.is_enabled;
    if (!enabled) continue;
    if (!program.frequency_months || program.frequency_months <= 0) continue;
    const baseline = lastByCode[program.code as (typeof ELEVATOR_PROGRAM_CODES)[number]];
    if (!baseline) continue;
    const next = advanceToFuture(
      addMonths(baseline, program.frequency_months),
      program.frequency_months,
    );
    dueCandidates.push(next);
  }

  const nextDue = dueCandidates.length
    ? new Date(Math.min(...dueCandidates.map((d) => d.getTime())))
    : null;
  return { lastInspection, nextDue };
}

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

    // Get org_id from user's org memberships
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

    // Verify property belongs to org
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select(
        'id, name, address_line1, borough, borough_code, bin, org_id, building_id, total_units, hpd_registration_id, hpd_building_id',
      )
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const propertyRow = property as PropertyRow;
    const buildingId = propertyRow.building_id ?? null;
    const buildingQuery = buildingId
      ? supabaseAdmin
          .from('buildings')
          .select(
            'id, borough_code, occupancy_group, occupancy_description, is_one_two_family, is_private_residence_building, residential_units, hpd_registration',
          )
          .eq('id', buildingId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null });

    // Fetch compliance data
    const [
      itemsResult,
      violations,
      assetsResult,
      eventsResp,
      programsResp,
      overridesResp,
      buildingResp,
      filingsResp,
    ] = await Promise.all([
      ComplianceService.getItemsByProperty(propertyId, orgId),
      ComplianceService.getViolationsByProperty(propertyId, orgId),
      ComplianceService.getAssetsByProperty(propertyId, orgId),
      supabaseAdmin
        .from('compliance_events')
        .select(
          'id, asset_id, item_id, inspection_date, filed_date, event_type, inspection_type, compliance_status, external_tracking_number, created_at',
        )
        .eq('property_id', propertyId)
        .eq('org_id', orgId)
        .order('inspection_date', { ascending: false, nullsFirst: false })
        .limit(100),
      supabaseAdmin
        .from('compliance_programs')
        .select(
          '*, template:compliance_program_templates(id, code, jurisdiction, frequency_months, lead_time_days, applies_to, severity_score)',
        )
        .eq('org_id', orgId),
      supabaseAdmin
        .from('compliance_property_program_overrides')
        .select('*')
        .eq('org_id', orgId)
        .eq('property_id', propertyId),
      buildingQuery,
      supabaseAdmin
        .from('building_permits')
        .select(
          'id, source, dataset_id, job_filing_number, work_permit, sequence_number, work_type, permit_status, job_description, approved_date, issued_date, bin, block, lot, bbl, house_no, street_name, borough, metadata',
        )
        .eq('property_id', propertyId)
        .eq('org_id', orgId),
    ]);
    const building = (buildingResp?.data as BuildingRow | null) ?? null;
    let items: ComplianceItemWithProgram[] = Array.isArray(itemsResult)
      ? (itemsResult as ComplianceItemWithProgram[])
      : [];
    let assets: AssetWithSchedule[] = Array.isArray(assetsResult)
      ? (assetsResult as Array<Partial<AssetWithSchedule>>).map((asset) => {
          const pressure_type =
            typeof (asset as { pressure_type?: unknown }).pressure_type === 'string'
              ? (asset as { pressure_type?: string }).pressure_type
              : null;
          return { ...asset, pressure_type } as AssetWithSchedule;
        })
      : [];

    if (programsResp.error) {
      logger.error(
        { error: programsResp.error, propertyId, orgId },
        'Failed to load compliance programs for property',
      );
      return NextResponse.json({ error: 'Failed to load compliance programs' }, { status: 500 });
    }

    if (overridesResp.error) {
      logger.error(
        { error: overridesResp.error, propertyId, orgId },
        'Failed to load compliance program overrides for property',
      );
      return NextResponse.json({ error: 'Failed to load compliance programs' }, { status: 500 });
    }

    const programs: ProgramRow[] = (programsResp.data as ProgramRow[]) || [];
    const filings = filingsResp?.data || [];
    if (buildingResp && buildingResp.error) {
      logger.warn(
        { error: buildingResp.error, propertyId, orgId },
        'Failed to load building metadata for compliance view',
      );
    }

    const boroughCodeRaw = propertyRow.borough_code ?? building?.borough_code ?? null;
    const borough_code =
      typeof boroughCodeRaw === 'string'
        ? Number.isNaN(Number(boroughCodeRaw))
          ? null
          : Number(boroughCodeRaw)
        : boroughCodeRaw ?? null;

    const propertyMeta = {
      id: propertyRow.id,
      borough: propertyRow.borough,
      borough_code,
      bin: propertyRow.bin,
      occupancy_group: building?.occupancy_group ?? null,
      occupancy_description: building?.occupancy_description ?? null,
      is_one_two_family: building?.is_one_two_family ?? null,
      is_private_residence_building: building?.is_private_residence_building ?? null,
      residential_units: building?.residential_units ?? null,
      property_total_units: propertyRow.total_units ?? null,
    };

    const assetMetas: AssetMeta[] = assets.map((asset) => {
      const meta = (asset.metadata ?? {}) as Record<string, unknown>;
      const metaPressure =
        typeof meta.pressure_type === 'string'
          ? meta.pressure_type
          : typeof meta.pressuretype === 'string'
            ? meta.pressuretype
            : null;
      const assetPressure =
        typeof (asset as { pressure_type?: unknown }).pressure_type === 'string'
          ? (asset as { pressure_type?: string }).pressure_type
          : null;
      const deviceCategory =
        typeof asset.device_category === 'string'
          ? (asset.device_category as ComplianceDeviceCategory)
          : null;
      const canonical = canonicalAssetType(asset) as ComplianceAssetType | null;
      const normalizedAssetType: ComplianceAssetType =
        canonical ??
        (typeof asset.asset_type === 'string'
          ? ((asset.asset_type as string).toLowerCase() as ComplianceAssetType)
          : null) ??
        'other';
      return {
        id: asset.id,
        property_id: asset.property_id,
        asset_type: normalizedAssetType,
        external_source: asset.external_source,
        active: asset.active !== false,
        metadata: meta as Json,
        device_category: deviceCategory,
        device_technology: asset.device_technology ?? null,
        device_subtype: asset.device_subtype ?? null,
        is_private_residence: asset.is_private_residence ?? null,
        pressure_type: metaPressure ?? assetPressure ?? null,
      } as AssetMeta;
    });

    const assetMetaMap = new Map(assetMetas.map((asset) => [asset.id, asset]));
    const overrides: CompliancePropertyProgramOverride[] = overridesResp?.data || [];
    const overrideByProgram = new Map(overrides.map((override) => [override.program_id, override]));

    const programsWithContext = (programs || []).map((program) => {
      const override = overrideByProgram.get(program.id ?? '') || null;
      const suppressed = override?.is_assigned === false;
      const assigned = override ? override.is_assigned !== false : false;
      const overrideFields = (program.override_fields || {}) as Record<string, unknown>;
      const criteriaRows =
        (overrideFields as { criteria_rows?: unknown; criteriaRows?: unknown }).criteria_rows ??
        (overrideFields as { criteriaRows?: unknown }).criteriaRows ??
        null;
      const hasDefinedCriteriaRows = Array.isArray(criteriaRows);
      const criteriaRowsEmpty = hasDefinedCriteriaRows && criteriaRows.length === 0;
      const matchesProperty = criteriaRowsEmpty ? false : programTargetsProperty(program, propertyMeta);
      const matchesAssets = criteriaRowsEmpty
        ? false
        : assetMetas.some((asset) => programTargetsAsset(program, asset, propertyMeta));
      const matchesCriteria = matchesProperty || matchesAssets;
      const effective_is_enabled =
        typeof override?.is_enabled === 'boolean' ? override.is_enabled : program.is_enabled;
      const applicable = !suppressed && (assigned || matchesCriteria);
      const warning_message =
        !program.is_enabled && effective_is_enabled
          ? 'This program is disabled globally but enabled for this property'
          : undefined;

      return {
        ...program,
        override,
        is_assigned: assigned,
        suppressed,
        matches_criteria: matchesCriteria,
        effective_is_enabled,
        applicable,
        warning_message,
      };
    });

    const applicablePrograms = programsWithContext.filter((program) => program.applicable);
    const enabledPrograms = applicablePrograms.filter((program) => program.effective_is_enabled);
    const enabledProgramIds = new Set(enabledPrograms.map((p) => p.id));
    const programContextById = new Map(applicablePrograms.map((program) => [program.id, program]));

    const itemMatchesCriteria = (item: ComplianceItemWithProgram) => {
      if (!enabledProgramIds.has(item.program_id)) return false;
      const program = programContextById.get(item.program_id);
      if (!program || program.suppressed) return false;
      if (program.is_assigned) return true;
      const assetMeta = item.asset_id ? assetMetaMap.get(item.asset_id) || null : null;
      if (item.asset_id) return programTargetsAsset(program, assetMeta, propertyMeta);
      return programTargetsProperty(program, propertyMeta);
    };

    items = (items || []).filter((item) => itemMatchesCriteria(item));

    const generator = new ComplianceItemGenerator();

    // Clean up mismatched boiler programs (LP vs HP) based on asset pressure; also regenerate correct items if missing.
    try {
      const pressureByAsset = new Map<string, 'low_pressure' | 'high_pressure'>();
      const boilerAssets = (assets || []).filter((asset) => asset.asset_type === 'boiler');
      boilerAssets.forEach((asset) => {
        const pressure = getBoilerPressure(asset);
        if (pressure) pressureByAsset.set(asset.id, pressure);
      });

      const lpProgram = (programs || []).find((p) => p.code === 'NYC_BOILER_LP_ANNUAL');
      const hpProgram = (programs || []).find((p) => p.code === 'NYC_BOILER_HP_ANNUAL');

      const boilerDeletes: string[] = [];
      const boilerGenerate: string[] = [];

      for (const asset of boilerAssets) {
        const pressure = pressureByAsset.get(asset.id as string);
        if (!pressure) continue;
        const expectedProgramId = pressure === 'low_pressure' ? lpProgram?.id : hpProgram?.id;
        const oppositeProgramId = pressure === 'low_pressure' ? hpProgram?.id : lpProgram?.id;

        if (oppositeProgramId) {
          const invalidItems =
            items?.filter(
              (item) => item.asset_id === asset.id && item.program_id === oppositeProgramId,
            ) || [];
          boilerDeletes.push(...invalidItems.map((item) => item.id));
        }

        if (expectedProgramId) {
          const hasExpected =
            items &&
            items.some(
              (item) => item.asset_id === asset.id && item.program_id === expectedProgramId,
            );
          if (!hasExpected) {
            boilerGenerate.push(asset.id as string);
          }
        }
      }

      if (boilerDeletes.length || boilerGenerate.length) {
        if (boilerDeletes.length) {
          items = (items || []).filter((item) => !boilerDeletes.includes(item.id));
          await supabaseAdmin
            .from('compliance_items')
            .delete()
            .eq('org_id', orgId)
            .eq('property_id', propertyId)
            .in('id', boilerDeletes);
        }

        if (boilerGenerate.length) {
          const uniqueBoilerAssetIds = Array.from(new Set(boilerGenerate));
          await Promise.all(
            uniqueBoilerAssetIds.map((assetId) =>
              generator.generateItemsForAsset(assetId, orgId, 12),
            ),
          );
        }

        items = (await ComplianceService.getItemsByProperty(
          propertyId,
          orgId,
        )) as ComplianceItemWithProgram[];
      }
    } catch (cleanupErr) {
      logger.warn({ error: cleanupErr, propertyId, orgId }, 'Boiler pressure cleanup skipped');
    }

    // Ensure compliance items exist for enabled programs; generate missing items without per-program loops.
    try {
      const itemsByProgram = new Map<string, ComplianceItemWithProgram[]>();
      (items || []).forEach((item) => {
        const arr = itemsByProgram.get(item.program_id) || [];
        arr.push(item);
        itemsByProgram.set(item.program_id, arr);
      });

      const programsMissingItems = enabledPrograms.filter(
        (program) => (itemsByProgram.get(program.id) || []).length === 0,
      );

      if (programsMissingItems.length > 0) {
        const needsAssetGeneration = programsMissingItems.some(
          (program) => program.applies_to === 'asset' || program.applies_to === 'both',
        );
        const needsPropertyGeneration = programsMissingItems.some(
          (program) => program.applies_to === 'property' || program.applies_to === 'both',
        );

        const generationTasks: Promise<unknown>[] = [];

        if (needsAssetGeneration && assets && assets.length > 0) {
          const uniqueAssetIds = Array.from(new Set(assets.map((asset) => asset.id)));
          generationTasks.push(
            Promise.all(
              uniqueAssetIds.map((assetId) =>
                generator.generateItemsForAsset(assetId, orgId, 12),
              ),
            ),
          );
        }

        if (needsPropertyGeneration) {
          generationTasks.push(generator.generateItemsForProperty(propertyId, orgId, 12));
        }

        if (generationTasks.length > 0) {
          await Promise.all(generationTasks);
          items = (await ComplianceService.getItemsByProperty(
            propertyId,
            orgId,
          )) as ComplianceItemWithProgram[];
        }
      }
    } catch (genErr) {
      logger.error(
        { error: genErr, propertyId, orgId },
        'Failed to generate missing compliance items',
      );
    }

    // Ensure only programs that apply to this property/device are returned after generation
    items = (items || []).filter((item) => itemMatchesCriteria(item));

    const eventsData: ComplianceEvent[] = (eventsResp.data as ComplianceEvent[]) || [];

    const elevatorPrograms = enabledPrograms.filter((p) => ELEVATOR_PROGRAM_CODES.includes(p.code));

    const assetsWithSchedule = (assets || []).map((asset) => {
      if (asset.asset_type !== 'elevator') return asset;
      const { lastInspection, nextDue } = computeElevatorSchedule(
        asset,
        eventsData,
        elevatorPrograms,
      );
      return {
        ...asset,
        last_inspection_at: lastInspection ? lastInspection.toISOString() : null,
        next_due: nextDue ? nextDue.toISOString().split('T')[0] : null,
      };
    });

    assets = assetsWithSchedule;

    const hasHpdRegistration =
      Boolean(propertyRow?.hpd_registration_id) ||
      Boolean(building?.hpd_registration) ||
      Boolean((building?.hpd_registration as Record<string, unknown> | null | undefined)?.registrationid);

    const registrationEndDateRaw =
      (building?.hpd_registration as Record<string, unknown> | null | undefined)?.registrationenddate ||
      null;
    const registrationEndDate =
      typeof registrationEndDateRaw === 'string' && registrationEndDateRaw.length > 0
        ? registrationEndDateRaw
        : null;
    const hpdDueUpdates: Array<{ id: string; due_date: string }> = [];

    items = (items || []).map((item) => {
      if (item?.program?.code === 'NYC_HPD_REGISTRATION') {
        let updated = item;
        if (!hasHpdRegistration) {
          const nextAction = item.next_action || 'File HPD Multiple Dwelling Registration';
          updated = { ...updated, status: 'overdue', next_action: nextAction };
        }
        const normalizedDue = computeHpdRegistrationDueDate(item, registrationEndDate);
        if (normalizedDue && item.due_date !== normalizedDue) {
          hpdDueUpdates.push({ id: item.id, due_date: normalizedDue });
          updated = { ...updated, due_date: normalizedDue };
        }
        return updated;
      }
      return item;
    });

    if (hpdDueUpdates.length) {
      try {
        const results = await Promise.all(
          hpdDueUpdates.map((row) =>
            supabaseAdmin.from('compliance_items').update({ due_date: row.due_date }).eq('id', row.id),
          ),
        );
        results.forEach(({ error }, idx) => {
          if (error) {
            logger.warn(
              { error, propertyId, orgId, itemId: hpdDueUpdates[idx].id },
              'Failed to normalize HPD registration due date',
            );
          }
        });
      } catch (updateErr) {
        logger.warn(
          { error: updateErr, propertyId, orgId },
          'HPD registration due date normalization failed',
        );
      }
    }

    // Enforce 5-year horizon on returned items
    const horizon = new Date();
    horizon.setFullYear(horizon.getFullYear() + 5);
    items = items.filter((item) => {
      const due = new Date(item.due_date);
      return due <= horizon;
    });

    // Calculate upcoming inspections for each device
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfYear = new Date(today.getFullYear(), 11, 31); // Dec 31 of current year

    // Get set of item IDs that have completion events (completed items)
    const completedItemIds = new Set(
      eventsData.filter((e) => e.item_id).map((e) => e.item_id as string),
    );

    // Calculate upcoming inspections count per device
    const upcomingInspectionsByDevice = new Map<string, number>();
    items.forEach((item) => {
      if (!item.asset_id) return; // Skip property-level items
      if (completedItemIds.has(item.id)) return; // Skip completed items

      const dueDate = new Date(item.due_date);
      dueDate.setHours(0, 0, 0, 0);

      // Check if due date is from today through Dec 31 of current year
      if (dueDate >= today && dueDate <= endOfYear) {
        const current = upcomingInspectionsByDevice.get(item.asset_id) || 0;
        upcomingInspectionsByDevice.set(item.asset_id, current + 1);
      }
    });

    // Add upcoming_inspections to each asset
    assets = assets.map((asset) => ({
      ...asset,
      upcoming_inspections: upcomingInspectionsByDevice.get(asset.id) || 0,
    }));

    // Calculate summary
    const overdueItems = items.filter((item) => item.status === 'overdue').length;
    const itemsDueNext30Days = items.filter((item) => {
      if (item.status !== 'not_started' && item.status !== 'scheduled') return false;
      const dueDate = new Date(item.due_date);
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return dueDate <= thirtyDaysFromNow && dueDate >= new Date();
    }).length;

    const openViolationsCount = violations.filter(
      (v) => v.status === 'open' || v.status === 'in_progress',
    ).length;

    const earliestDueItem = items
      .filter(
        (item) =>
          item.status === 'not_started' || item.status === 'scheduled' || item.status === 'overdue',
      )
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
    const elevatorNextDue = assetsWithSchedule
      .map((asset) => asset.next_due)
      .filter((d): d is string => typeof d === 'string' && d.length > 0)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
    const nextDue = earliestDueItem?.due_date || elevatorNextDue || null;

    const lastSync = eventsData[0]?.created_at || null;

    // Agency summaries
    const byAgency = violations.reduce<Record<string, { count: number; lastDate: string | null }>>(
      (acc, v) => {
        const agency = v.agency || 'OTHER';
        if (!acc[agency]) acc[agency] = { count: 0, lastDate: null };
        acc[agency].count += 1;
        const date = v.issue_date ? new Date(v.issue_date).toISOString() : null;
        if (date && (!acc[agency].lastDate || date > acc[agency].lastDate)) {
          acc[agency].lastDate = date;
        }
        return acc;
      },
      {},
    );

    const hpd = {
      registration_id: propertyRow.hpd_registration_id || null,
      building_id: propertyRow.hpd_building_id || null,
      violations: byAgency.HPD?.count || 0,
      complaints: 0,
      last_event_date: byAgency.HPD?.lastDate || null,
    };

    const fdny = {
      open_violations: byAgency.FDNY?.count || 0,
      last_event_date: byAgency.FDNY?.lastDate || null,
    };

    const dep = {
      open_violations: byAgency.DEP?.count || 0,
      last_event_date: byAgency.DEP?.lastDate || null,
    };

    // Determine how many devices have a usable status (aligns with UI filtering)
    const devicesWithStatus = assets.filter((asset) => {
      const meta = (asset.metadata ?? null) as Record<string, unknown> | null;
      const status =
        (meta?.device_status as string | undefined | null) ||
        (meta?.status as string | undefined | null);
      return Boolean(status);
    }).length;

    // Activity timeline: combine latest violations + events (limit 50)
    const timeline = [
      ...violations.map((v) => ({
        type: 'violation',
        date: v.issue_date,
        title: v.violation_number,
        status: v.status,
        agency: v.agency,
      })),
      ...eventsData.map((e) => ({
        type: 'event',
        date: e.inspection_date || e.filed_date || e.created_at,
        title: e.inspection_type || e.event_type,
        status: normalizeEventResult(e.compliance_status),
        agency: e.inspection_type ? 'DOB' : null,
      })),
    ]
      .filter((t) => t.date)
      .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime())
      .slice(0, 50);

    return NextResponse.json({
      property: {
        id: propertyRow.id,
        name: propertyRow.name,
        address_line1: propertyRow.address_line1,
        borough: propertyRow.borough,
        bin: propertyRow.bin,
        building_id: propertyRow.building_id || null,
        total_units: propertyRow.total_units || null,
      },
      building,
      items,
      violations,
      assets,
      programs: applicablePrograms,
      events: eventsData,
      filings,
      kpis: {
        devices: devicesWithStatus,
        open_violations: openViolationsCount,
        next_due: nextDue,
        last_sync: lastSync,
        status_chip: computeStatusChip(openViolationsCount, overdueItems),
      },
      agencies: {
        hpd,
        fdny,
        dep,
      },
      timeline,
      summary: {
        open_violations: openViolationsCount,
        overdue_items: overdueItems,
        items_due_next_30_days: itemsDueNext30Days,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error in property compliance API');
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
