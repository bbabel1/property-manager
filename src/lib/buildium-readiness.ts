import { mapPropertyToBuildium } from '@/lib/buildium-mappers';
import { validateBuildiumPropertyPayload } from '@/app/api/properties/route';
import type { OnboardingStatus } from '@/schemas/onboarding';

type SupabaseClientLike = {
  from: (table: string) => any;
};

export type BuildiumReadinessIssue = {
  code: string;
  message: string;
  path?: string;
  blocking?: boolean;
};

type EvaluateArgs = {
  db: SupabaseClientLike;
  propertyId: string;
  orgId: string;
  property?: Record<string, any> | null;
};

export async function evaluateBuildiumReadiness({
  db,
  propertyId,
  orgId,
  property: providedProperty,
}: EvaluateArgs): Promise<{ ready: boolean; issues: BuildiumReadinessIssue[]; property: Record<string, any> | null }> {
  let property = providedProperty ?? null;

  if (!property) {
    const { data, error } = await db
      .from('properties')
      .select(
        `
        id,
        name,
        address_line1,
        address_line2,
        address_line3,
        city,
        state,
        postal_code,
        country,
        property_type,
        service_assignment,
        management_scope,
        structure_description,
        total_units,
        reserve,
        is_active,
        operating_bank_account_id,
        buildium_operating_bank_account_id,
        buildium_gl_account_id
      `,
      )
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (error) {
      return { ready: false, issues: [{ code: 'FETCH_ERROR', message: 'Failed to load property', blocking: true }], property: null };
    }
    property = data;
  }

  if (!property) {
    return { ready: false, issues: [{ code: 'NOT_FOUND', message: 'Property not found', blocking: true }], property: null };
  }

  // Validate Buildium-required fields using shared mapper/validator
  const buildiumPayload = mapPropertyToBuildium(property as any);
  const validation = validateBuildiumPropertyPayload(buildiumPayload);
  const issues: BuildiumReadinessIssue[] = validation.missing.map((field) => ({
    code: `MISSING_${String(field).replace(/\./g, '_').toUpperCase()}`,
    message: `Missing required field: ${field}`,
    path: String(field),
    blocking: true,
  }));

  // Counts for owners/units
  const { count: unitCount, error: unitError } = await db
    .from('units')
    .select('id', { head: true, count: 'exact' })
    .eq('property_id', propertyId);
  if (unitError) {
    issues.push({ code: 'UNITS_FETCH_FAILED', message: 'Failed to load units', blocking: true });
  }
  if (!unitCount || unitCount === 0) {
    issues.push({ code: 'NO_UNITS', message: 'At least one unit is required', path: 'units', blocking: true });
  }

  const { count: ownerCount, error: ownerError } = await db
    .from('ownerships')
    .select('id', { head: true, count: 'exact' })
    .eq('property_id', propertyId);
  if (ownerError) {
    issues.push({ code: 'OWNERS_FETCH_FAILED', message: 'Failed to load owners', blocking: true });
  }
  if (!ownerCount || ownerCount === 0) {
    issues.push({ code: 'NO_OWNERS', message: 'At least one owner is required', path: 'ownerships', blocking: true });
  }

  if (!property.operating_bank_account_id && !property.buildium_operating_bank_account_id) {
    issues.push({
      code: 'BANK_ACCOUNT',
      message: 'Operating bank account is recommended before Buildium sync',
      path: 'operating_bank_account_id',
      blocking: false,
    });
  }

  const blockingIssues = issues.filter((i) => i.blocking !== false);

  return { ready: blockingIssues.length === 0, issues, property };
}

export async function updateOnboardingStatusForBuildium(
  db: SupabaseClientLike,
  propertyId: string,
  orgId: string,
  status: OnboardingStatus,
): Promise<void> {
  const { data: onboarding } = await db
    .from('property_onboarding')
    .select('id, status, progress')
    .eq('property_id', propertyId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (!onboarding) return;

  const progress =
    status === 'READY_FOR_BUILDIUM'
      ? Math.max(Number(onboarding.progress) || 0, 95)
      : status === 'BUILDIUM_SYNCED'
        ? 100
        : onboarding.progress;

  await db
    .from('property_onboarding')
    .update({ status, progress })
    .eq('id', onboarding.id);
}
