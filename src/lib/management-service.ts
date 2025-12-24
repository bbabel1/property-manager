'use server';

import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Database as DatabaseSchema } from '@/types/database';

type AssignmentRow = {
  id: string;
  plan_id: string | null;
  plan_fee_amount: number | null;
  plan_fee_percent: number | null;
  plan_fee_frequency: string | null;
  effective_start?: string | null;
  unit_id: string | null;
};

type PropertyRow = {
  id: string;
  org_id: string;
  service_assignment?: string | null;
  bill_administration_notes?: string | null;
};

type UnitRow = {
  id: string;
  property_id: string;
  unit_number: string | null;
  bill_administration_notes?: string | null;
  bill_administration?: string[] | null;
};

type ServiceOfferingAssignmentRow = Pick<
  DatabaseSchema['public']['Tables']['service_offering_assignments']['Row'],
  'offering_id' | 'is_active'
>;
type ServiceOfferingRow = Pick<
  DatabaseSchema['public']['Tables']['service_offerings']['Row'],
  'id' | 'name' | 'is_active'
>;
type PlanServiceRow = Pick<
  DatabaseSchema['public']['Tables']['service_plan_services']['Row'],
  'offering_id'
>;
type BillingFrequency = DatabaseSchema['public']['Enums']['billing_frequency_enum'];

export type ManagementServiceConfig = {
  property_id: string;
  unit_id: string | null;
  service_plan: string | null;
  active_services: string[];
  bill_administration: string | null;
  source: 'property' | 'unit';
  assignment_id: string | null;
  plan_id: string | null;
  fee_amount: number | null;
  fee_percent: number | null;
  billing_frequency: string | null;
  unit_number?: string | null;
};

export class ManagementServiceError extends Error {
  status: number;
  code: string;
  details?: string;

  constructor(code: string, message: string, status = 400, details?: string) {
    super(message);
    this.name = 'ManagementServiceError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const A_LA_CARTE_PLAN = 'a-la-carte';
const BILLING_FREQUENCIES: BillingFrequency[] = [
  'Annual',
  'Monthly',
  'monthly',
  'annually',
  'one_time',
  'per_event',
  'per_job',
  'quarterly',
];

function normalizePlanName(name: string | null | undefined) {
  return String(name ?? '').trim();
}

function isALaCarte(planName: string | null | undefined) {
  return normalizePlanName(planName).toLowerCase() === A_LA_CARTE_PLAN;
}

function coerceString(value: unknown) {
  return typeof value === 'string' ? value : value != null ? String(value) : '';
}

function normalizePlanFeeFrequency(value: string | BillingFrequency | null | undefined): BillingFrequency | null {
  if (!value) return null;
  const normalized = String(value).toLowerCase();
  const match = BILLING_FREQUENCIES.find((freq) => freq.toLowerCase() === normalized);
  return match ?? null;
}

async function requireProperty(propertyId: string, db: TypedSupabaseClient = supabaseAdmin) {
  const { data, error } = await db
    .from('properties')
    .select('id, org_id, service_assignment, bill_administration_notes')
    .eq('id', propertyId)
    .maybeSingle();

  if (error) {
    throw new ManagementServiceError('QUERY_ERROR', 'Failed to load property', 500, error.message);
  }
  if (!data) {
    throw new ManagementServiceError('NOT_FOUND', 'Property not found', 404);
  }
  return data as PropertyRow;
}

async function loadUnit(unitId: string, db: TypedSupabaseClient = supabaseAdmin) {
  const { data, error } = await db
    .from('units')
    .select('id, property_id, unit_number, bill_administration_notes, bill_administration')
    .eq('id', unitId)
    .maybeSingle();

  if (error) {
    throw new ManagementServiceError('QUERY_ERROR', 'Failed to load unit', 500, error.message);
  }
  return (data as UnitRow | null) ?? null;
}

async function loadLatestAssignment(
  orgId: string,
  propertyId: string,
  scope: 'property' | 'unit',
  unitId?: string | null,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<AssignmentRow | null> {
  const query = db
    .from('service_plan_assignments')
    .select(
      'id, plan_id, plan_fee_amount, plan_fee_percent, plan_fee_frequency, unit_id, effective_start',
    )
    .eq('org_id', orgId)
    .eq('property_id', propertyId)
    .is('effective_end', null)
    .order('effective_start', { ascending: false })
    .limit(1);

  const scoped =
    scope === 'unit' && unitId
      ? query.eq('unit_id', unitId)
      : query.is('unit_id', null);

  const { data, error } = await scoped.maybeSingle();
  if (error) {
    throw new ManagementServiceError(
      'QUERY_ERROR',
      'Failed to load service assignment',
      500,
      error.message,
    );
  }
  return (data as AssignmentRow | null) ?? null;
}

async function resolvePlanAndServices(
  planId: string | null,
  assignmentId: string | null,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<{ planName: string | null; activeServices: string[] }> {
  if (!planId) return { planName: null, activeServices: [] };

  const { data: plan, error: planError } = await db
    .from('service_plans')
    .select('name')
    .eq('id', planId)
    .maybeSingle();

  if (planError) {
    throw new ManagementServiceError(
      'QUERY_ERROR',
      'Failed to load service plan',
      500,
      planError.message,
    );
  }

  const planName = plan?.name ? coerceString(plan.name) : null;
  if (!planName) return { planName: null, activeServices: [] };

  const isAlaCarte = isALaCarte(planName);
  if (isAlaCarte) {
    if (!assignmentId) return { planName, activeServices: [] };

    const { data: rows, error: selectError } = await db
      .from('service_offering_assignments')
      .select('offering_id, is_active')
      .eq('assignment_id', assignmentId);

    if (selectError) {
      throw new ManagementServiceError(
        'QUERY_ERROR',
        'Failed to load selected services',
        500,
        selectError.message,
      );
    }

    const assignments: ServiceOfferingAssignmentRow[] = rows || [];
    const offeringIds = assignments
      .filter((row) => row?.is_active !== false)
      .map((row) => coerceString(row.offering_id))
      .filter(Boolean);

    if (!offeringIds.length) return { planName, activeServices: [] };

    const { data: offerings, error: offeringsError } = await db
      .from('service_offerings')
      .select('id, name')
      .in('id', offeringIds);

    if (offeringsError) {
      throw new ManagementServiceError(
        'QUERY_ERROR',
        'Failed to load service offerings',
        500,
        offeringsError.message,
      );
    }

    return {
      planName,
      activeServices: (offerings || []).map((row) => coerceString(row.name)).filter(Boolean),
    };
  }

  const { data: planServices, error: planServicesError } = await db
    .from('service_plan_services')
    .select('offering_id')
    .eq('plan_id', planId);

  if (planServicesError) {
    throw new ManagementServiceError(
      'QUERY_ERROR',
      'Failed to load plan services',
      500,
      planServicesError.message,
    );
  }

  const planServiceRows: PlanServiceRow[] = planServices || [];
  const offeringIds = planServiceRows
    .map((row) => coerceString(row.offering_id))
    .filter(Boolean);

  if (!offeringIds.length) return { planName, activeServices: [] };

  const { data: offerings, error: offeringsError } = await db
    .from('service_offerings')
    .select('id, name')
    .in('id', offeringIds);

  if (offeringsError) {
    throw new ManagementServiceError(
      'QUERY_ERROR',
      'Failed to load service offerings',
      500,
      offeringsError.message,
    );
  }

  return {
    planName,
    activeServices: (offerings || []).map((row) => coerceString(row.name)).filter(Boolean),
  };
}

function deriveBillAdministration(notes?: string | null, list?: string[] | null) {
  if (notes && notes.trim()) return notes;
  if (Array.isArray(list) && list.length) return list.map((v) => coerceString(v)).filter(Boolean).join(', ');
  return null;
}

export async function fetchManagementServiceConfig(params: {
  propertyId: string;
  unitId?: string | null;
  propertyRow?: PropertyRow | null;
  unitRow?: UnitRow | null;
}): Promise<ManagementServiceConfig> {
  const { propertyId, unitId } = params;
  const property = params.propertyRow ?? (await requireProperty(propertyId));
  const unit = unitId ? params.unitRow ?? (await loadUnit(unitId)) : null;

  if (unit && unit.property_id !== propertyId) {
    throw new ManagementServiceError(
      'INVALID_SCOPE',
      'Unit does not belong to the provided property',
      400,
    );
  }

  const assignmentMode = (property.service_assignment ?? 'Property Level') as
    | 'Property Level'
    | 'Unit Level';
  const wantsUnitLevel = assignmentMode === 'Unit Level' && !!unit;

  const [unitAssignment, propertyAssignment] = await Promise.all([
    unit ? loadLatestAssignment(property.org_id, propertyId, 'unit', unit.id) : Promise.resolve(null),
    loadLatestAssignment(property.org_id, propertyId, 'property'),
  ]);

  const primaryAssignment = wantsUnitLevel ? unitAssignment : propertyAssignment;
  const effectiveAssignment = primaryAssignment ?? unitAssignment ?? propertyAssignment;
  const source: 'property' | 'unit' =
    wantsUnitLevel && unitAssignment ? 'unit' : 'property';

  const planId = effectiveAssignment?.plan_id ? coerceString(effectiveAssignment.plan_id) : null;
  const { planName, activeServices } = await resolvePlanAndServices(
    planId,
    effectiveAssignment?.id ?? null,
  );

  return {
    property_id: propertyId,
    unit_id: unit?.id ?? null,
    service_plan: planName,
    active_services: activeServices,
    bill_administration:
      source === 'unit'
        ? deriveBillAdministration(unit?.bill_administration_notes, unit?.bill_administration)
        : deriveBillAdministration(property.bill_administration_notes, null),
    source,
    assignment_id: effectiveAssignment?.id ?? null,
    plan_id: planId,
    fee_amount:
      effectiveAssignment?.plan_fee_amount != null
        ? Number(effectiveAssignment.plan_fee_amount)
        : null,
    fee_percent:
      effectiveAssignment?.plan_fee_percent != null
        ? Number(effectiveAssignment.plan_fee_percent)
        : null,
    billing_frequency: effectiveAssignment?.plan_fee_frequency
      ? coerceString(effectiveAssignment.plan_fee_frequency)
      : null,
    unit_number: unit?.unit_number ?? null,
  };
}

async function resolveOrCreatePlan(orgId: string, planName: string, db: TypedSupabaseClient) {
  const normalizedName = normalizePlanName(planName);
  if (!normalizedName) {
    throw new ManagementServiceError('BAD_REQUEST', 'service_plan is required');
  }

  const { data: existing, error: lookupError } = await db
    .from('service_plans')
    .select('id')
    .eq('org_id', orgId)
    .ilike('name', normalizedName)
    .maybeSingle();

  if (lookupError) {
    throw new ManagementServiceError(
      'QUERY_ERROR',
      'Failed to resolve service plan',
      500,
      lookupError.message,
    );
  }

  if (existing?.id) return coerceString(existing.id);

  const { data: inserted, error: insertError } = await db
    .from('service_plans')
    .insert({
      org_id: orgId,
      name: normalizedName,
      amount_type: 'flat',
      percent_basis: 'lease_rent_amount',
      is_active: true,
    })
    .select('id')
    .maybeSingle();

  if (insertError || !inserted?.id) {
    throw new ManagementServiceError(
      'QUERY_ERROR',
      'Failed to create service plan',
      500,
      insertError?.message,
    );
  }

  return coerceString(inserted.id);
}

async function upsertAssignment(
  orgId: string,
  propertyId: string,
  unitId: string | null,
  planId: string,
  db: TypedSupabaseClient,
  options?: {
    planFeeAmount?: number | null;
    planFeePercent?: number | null;
    planFeeFrequency?: string | null;
  },
): Promise<AssignmentRow> {
  const desiredScope: 'property' | 'unit' = unitId ? 'unit' : 'property';
  const existing = await loadLatestAssignment(orgId, propertyId, desiredScope, unitId, db);
  const now = new Date().toISOString();
  const feeAmount = options?.planFeeAmount ?? null;
  const feePercent = options?.planFeePercent ?? null;
  const feeFrequency = options?.planFeeFrequency ?? null;
  const normalizedFrequency =
    normalizePlanFeeFrequency(feeFrequency ?? existing?.plan_fee_frequency ?? null) ?? 'monthly';

  if (existing?.id) {
    const { data, error } = await db
      .from('service_plan_assignments')
      .update({
        plan_id: planId,
        plan_fee_amount: feeAmount !== null ? feeAmount : existing.plan_fee_amount,
        plan_fee_percent: feePercent !== null ? feePercent : existing.plan_fee_percent,
        plan_fee_frequency: normalizedFrequency,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select(
        'id, plan_id, plan_fee_amount, plan_fee_percent, plan_fee_frequency, unit_id, effective_start',
      )
      .maybeSingle();

    if (error || !data) {
      throw new ManagementServiceError(
        'QUERY_ERROR',
        'Failed to update service assignment',
        500,
        error?.message,
      );
    }

    return data as AssignmentRow;
  }

  const { data, error } = await db
    .from('service_plan_assignments')
    .insert({
      org_id: orgId,
      property_id: propertyId,
      unit_id: unitId,
      plan_id: planId,
      plan_fee_amount: feeAmount,
      plan_fee_percent: feePercent ?? 0,
      plan_fee_frequency: normalizedFrequency,
      effective_start: now,
    })
    .select(
      'id, plan_id, plan_fee_amount, plan_fee_percent, plan_fee_frequency, unit_id, effective_start',
    )
    .maybeSingle();

  if (error || !data) {
    throw new ManagementServiceError(
      'QUERY_ERROR',
      'Failed to create service assignment',
      500,
      error?.message,
    );
  }

  return data as AssignmentRow;
}

async function replaceAssignmentServices(
  assignmentId: string,
  activeServices: string[],
  db: TypedSupabaseClient,
) {
  const desired = Array.from(
    new Set(
      (activeServices || [])
        .map((s) => coerceString(s).trim())
        .filter((s) => s.length > 0)
        .map((s) => s.toLowerCase()),
    ),
  );

  const { data: offerings, error: offeringsError } = await db
    .from('service_offerings')
    .select('id, name, is_active');

  if (offeringsError) {
    throw new ManagementServiceError(
      'QUERY_ERROR',
      'Failed to load service offerings',
      500,
      offeringsError.message,
    );
  }

  const offeringByName = new Map<string, string>();
  for (const row of (offerings || []) as ServiceOfferingRow[]) {
    const nameLc = coerceString(row.name).toLowerCase();
    if (!nameLc) continue;
    offeringByName.set(nameLc, coerceString(row.id));
  }

  const missing = desired.filter((name) => !offeringByName.has(name));
  if (missing.length) {
    throw new ManagementServiceError(
      'NOT_FOUND',
      `Service offerings not found: ${missing.join(', ')}`,
      400,
    );
  }

  const desiredOfferingIds = desired
    .map((name) => offeringByName.get(name))
    .filter((id): id is string => !!id);

  const { data: existingRows, error: existingError } = await db
    .from('service_offering_assignments')
    .select('offering_id')
    .eq('assignment_id', assignmentId);

  if (existingError) {
    throw new ManagementServiceError(
      'QUERY_ERROR',
      'Failed to load existing service selections',
      500,
      existingError.message,
    );
  }

  const existing = (existingRows || []) as ServiceOfferingAssignmentRow[];
  const existingIds = new Set(existing.map((row) => coerceString(row.offering_id)));
  const toDelete = Array.from(existingIds).filter((id) => !desiredOfferingIds.includes(id));
  if (toDelete.length) {
    const { error: deleteError } = await db
      .from('service_offering_assignments')
      .delete()
      .eq('assignment_id', assignmentId)
      .in('offering_id', toDelete);

    if (deleteError) {
      throw new ManagementServiceError(
        'QUERY_ERROR',
        'Failed to update service selections',
        500,
        deleteError.message,
      );
    }
  }

  if (desiredOfferingIds.length) {
    const upsertRows = desiredOfferingIds.map((offeringId) => ({
      assignment_id: assignmentId,
      offering_id: offeringId,
      is_active: true,
      override_amount: false,
      override_frequency: false,
      amount: null,
      frequency: null,
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await db
      .from('service_offering_assignments')
      .upsert(upsertRows, { onConflict: 'assignment_id,offering_id' });

    if (upsertError) {
      throw new ManagementServiceError(
        'QUERY_ERROR',
        'Failed to save service selections',
        500,
        upsertError.message,
      );
    }
  }
}

export async function upsertManagementServiceConfig(params: {
  propertyId: string;
  unitId?: string | null;
  servicePlan: string;
  activeServices?: string[];
  billAdministration?: string | null;
  planFeeAmount?: number | null;
  planFeePercent?: number | null;
  planFeeFrequency?: string | null;
}): Promise<ManagementServiceConfig> {
  const db = supabaseAdmin;
  const {
    propertyId,
    unitId,
    servicePlan,
    activeServices,
    billAdministration,
    planFeeAmount,
    planFeePercent,
    planFeeFrequency,
  } = params;
  const property = await requireProperty(propertyId, db);
  const unit = unitId ? await loadUnit(unitId, db) : null;

  if (unit && unit.property_id !== propertyId) {
    throw new ManagementServiceError(
      'INVALID_SCOPE',
      'Unit does not belong to the provided property',
      400,
    );
  }

  const desiredAssignment: 'Property Level' | 'Unit Level' = unit ? 'Unit Level' : 'Property Level';
  const currentAssignment = (property.service_assignment ?? null) as
    | 'Property Level'
    | 'Unit Level'
    | null;

  if (currentAssignment && currentAssignment !== desiredAssignment) {
    throw new ManagementServiceError(
      'INVALID_SCOPE',
      desiredAssignment === 'Property Level'
        ? 'Property is set to Unit Level assignments. Provide a unitId to update unit-level services.'
        : 'Property is set to Property Level assignments. Switch the property to Unit Level before updating a unit.',
      400,
    );
  }

  if (!currentAssignment) {
    const { error: updateError } = await db
      .from('properties')
      .update({ service_assignment: desiredAssignment })
      .eq('id', propertyId);

    if (updateError) {
      throw new ManagementServiceError(
        'QUERY_ERROR',
        'Failed to set service assignment on property',
        500,
        updateError.message,
      );
    }
  }

  const planId = await resolveOrCreatePlan(property.org_id, servicePlan, db);
  const assignment = await upsertAssignment(
    property.org_id,
    propertyId,
    unit?.id ?? null,
    planId,
    db,
    {
      planFeeAmount,
      planFeePercent,
      planFeeFrequency,
    },
  );

  if (Array.isArray(activeServices)) {
    try {
      await replaceAssignmentServices(assignment.id, activeServices, db);
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), assignmentId: assignment.id },
        'Failed to upsert management service offerings',
      );
      throw err;
    }
  }

  if (billAdministration !== undefined) {
    const targetTable = unit ? 'units' : 'properties';
    const targetIdColumn = unit ? 'id' : 'id';
    const targetIdValue = unit ? unit.id : propertyId;

    const { error: billError } = await db
      .from(targetTable as 'units' | 'properties')
      .update({ bill_administration_notes: billAdministration ?? null })
      .eq(targetIdColumn, targetIdValue);

    if (billError) {
      throw new ManagementServiceError(
        'QUERY_ERROR',
        'Failed to update billing notes',
        500,
        billError.message,
      );
    }
  }

  return fetchManagementServiceConfig({
    propertyId,
    unitId: unit?.id ?? null,
    propertyRow: { ...property, service_assignment: desiredAssignment },
    unitRow: unit ?? undefined,
  });
}

export async function listUnitManagementServiceConfigs(propertyId: string) {
  const db = supabaseAdmin;
  const property = await requireProperty(propertyId, db);
  const { data: units, error } = await db
    .from('units')
    .select('id, property_id, unit_number, bill_administration_notes, bill_administration')
    .eq('property_id', propertyId);

  if (error) {
    throw new ManagementServiceError(
      'QUERY_ERROR',
      'Failed to load units for property',
      500,
      error.message,
    );
  }

  const unitRows = Array.isArray(units) ? (units as UnitRow[]) : [];
  const configs = await Promise.all(
    unitRows.map((unit) =>
      fetchManagementServiceConfig({
        propertyId,
        unitId: unit.id,
        propertyRow: property,
        unitRow: unit,
      }),
    ),
  );

  return configs;
}

export class ManagementService {
  propertyId: string;
  unitId: string | null;

  constructor(propertyId: string, unitId?: string | null) {
    this.propertyId = propertyId;
    this.unitId = unitId ?? null;
  }

  async getServiceConfiguration() {
    return fetchManagementServiceConfig({ propertyId: this.propertyId, unitId: this.unitId });
  }

  async updateServiceConfiguration(input: {
    service_plan: string;
    active_services?: string[];
    bill_administration?: string | null;
  }) {
    return upsertManagementServiceConfig({
      propertyId: this.propertyId,
      unitId: this.unitId,
      servicePlan: input.service_plan,
      activeServices: input.active_services,
      billAdministration: input.bill_administration,
    });
  }

  static async listUnits(propertyId: string) {
    return listUnitManagementServiceConfigs(propertyId);
  }
}
