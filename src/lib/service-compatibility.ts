/**
 * Service Compatibility Layer
 *
 * Provides dual-write and backward compatibility functions for migrating
 * from legacy management_services_enum to new service_offerings catalog
 * Part of Phase 7.2: Dual-Write Implementation
 */

import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Database } from '@/types/database';

type BillingBasis = Database['public']['Enums']['billing_basis_enum'];
type RentBasis = Database['public']['Enums']['rent_basis_enum'];
type ServicePlan = Database['public']['Enums']['service_plan_enum'];

const endOfMonthFromPeriodStart = (periodStart: string): string => {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
};

/**
 * Service name mapping from legacy enum to new offering codes
 */
const LEGACY_SERVICE_MAPPING: Record<string, string> = {
  'Rent Collection': 'RENT_COLLECTION',
  Maintenance: 'MAINTENANCE_REPAIR',
  Turnovers: 'TURNOVER',
  Compliance: 'COMPLIANCE_AUDIT',
  'Bill Pay': 'BILL_PAY_ESCROW',
  'Condition Reports': 'INSPECTIONS',
  Renewals: 'RENEWAL',
};

/**
 * Reverse mapping: offering code to legacy enum name
 */
const OFFERING_TO_LEGACY_MAPPING: Record<string, string> = Object.fromEntries(
  Object.entries(LEGACY_SERVICE_MAPPING).map(([k, v]) => [v, k]),
);

/**
 * Write service fee to both old and new structures (dual-write)
 */
export async function writeServiceFeeDual(params: {
  monthlyLogId: string;
  propertyId: string;
  unitId?: string | null;
  amount: number;
  planId?: ServicePlan | null;
  offeringId?: string | null;
  feeCategory: 'plan_fee' | 'service_fee' | 'override' | 'legacy';
  legacyMemo?: string;
  sourceBasis?: BillingBasis;
  rentBasis?: RentBasis | null;
  rentAmount?: number | null;
  db?: TypedSupabaseClient;
}): Promise<{ transactionId: string; billingEventId?: string }> {
  const {
    monthlyLogId,
    propertyId,
    unitId,
    amount,
    planId,
    offeringId,
    feeCategory,
    legacyMemo,
    sourceBasis,
    rentBasis,
    rentAmount,
    db = supabaseAdmin,
  } = params;

  let propertyOrgId: string | null = null;
  // Always create billing_event when feature flag is enabled
  let billingEventId: string | undefined;
  if (offeringId) {
    // Get org_id from property
    const { data: property } = await db
      .from('properties')
      .select('org_id')
      .eq('id', propertyId)
      .single();

    if (property?.org_id) {
      propertyOrgId = property.org_id;
      // Get period from monthly log
      const { data: monthlyLog } = await db
        .from('monthly_logs')
        .select('period_start')
        .eq('id', monthlyLogId)
        .single();

      if (monthlyLog) {
        const periodEnd = endOfMonthFromPeriodStart(monthlyLog.period_start);
        // Default basis since service offerings no longer carry billing_basis
        const basis: BillingBasis = sourceBasis ?? 'per_property';

        // Avoid duplicate billing event (uniqueness constraint)
        const servicePeriodStart = monthlyLog.period_start;
        const servicePeriodEnd = periodEnd;
        const { data: billingEvent, error: beError } = await db
          .from('billing_events')
          .upsert(
            {
              org_id: propertyOrgId,
              property_id: propertyId,
              unit_id: unitId || null,
              offering_id: offeringId,
              plan_id: planId ?? null,
              period_start: monthlyLog.period_start,
              period_end: periodEnd,
              service_period_start: servicePeriodStart,
              service_period_end: servicePeriodEnd,
              charge_type: 'plan_fee',
              amount,
              source_basis: basis,
              rent_basis: rentBasis ?? null,
              rent_amount: rentAmount ?? null,
              calculated_at: new Date().toISOString(),
            },
            {
              onConflict:
                'org_id,unit_id,offering_id,assignment_id,charge_type,service_period_start,service_period_end',
            },
          )
          .select('id')
          .maybeSingle();

        if (beError) {
          logger.error({ error: beError }, 'Error creating billing event (dual-write)');
          // Continue anyway - don't fail the transaction
        } else if (billingEvent?.id) {
          billingEventId = billingEvent.id;
        }
      } else {
        logger.warn({ monthlyLogId }, 'Monthly log not found; skipping billing event creation');
      }
    } else {
      logger.warn({ propertyId }, 'Property org_id not found; skipping billing event creation');
    }
  }

  // Create transaction (always, for backward compatibility)
  const memo = legacyMemo || `Management Fee - ${planId || 'Standard'} Plan`;
  const nowIso = new Date().toISOString();
  const { data: transaction, error: txError } = await db
    .from('transactions')
    .insert({
      monthly_log_id: monthlyLogId,
      transaction_type: 'Charge',
      total_amount: amount,
      date: nowIso.split('T')[0],
      memo,
      service_offering_id: offeringId || null,
      plan_id: planId ?? null,
      fee_category: feeCategory,
      legacy_memo: legacyMemo || null,
      org_id: propertyOrgId,
      status: 'Due',
      updated_at: nowIso,
    })
    .select('id')
    .single();

  if (txError) {
    logger.error({ error: txError }, 'Error creating transaction (dual-write)');
    throw new Error(`Failed to create transaction: ${txError.message}`);
  }

  // Link billing event to transaction if both exist
  if (billingEventId && transaction.id) {
    await db
      .from('billing_events')
      .update({ transaction_id: transaction.id })
      .eq('id', billingEventId);
  }

  return {
    transactionId: transaction.id,
    billingEventId,
  };
}

/**
 * Read service fee from new structure, fall back to old if needed
 */
export async function readServiceFeeDual(params: {
  monthlyLogId: string;
  db?: TypedSupabaseClient;
}): Promise<{
  amount: number;
  source: 'new' | 'legacy';
  offeringIds?: string[];
  planId?: string | null;
}> {
  const { monthlyLogId, db = supabaseAdmin } = params;

  // Try to read from billing_events
  const { data: matchingTransaction } = await db
    .from('transactions')
    .select('id')
    .eq('monthly_log_id', monthlyLogId)
    .eq('transaction_type', 'Charge')
    .ilike('memo', '%management fee%')
    .limit(1)
    .maybeSingle();

  const transactionIdForQuery = matchingTransaction?.id ?? '';

  const { data: billingEvents } = await db
    .from('billing_events')
    .select('amount, offering_id, plan_id')
    .eq('transaction_id', transactionIdForQuery);

  if (billingEvents && billingEvents.length > 0) {
    const total = billingEvents.reduce((sum, be) => sum + (be.amount || 0), 0);
    return {
      amount: total,
      source: 'new',
      offeringIds: billingEvents.map((be) => be.offering_id).filter(Boolean) as string[],
      planId: billingEvents[0]?.plan_id || null,
    };
  }

  // Fall back to legacy calculation
  const { data: transactions } = await db
    .from('transactions')
    .select('total_amount')
    .eq('monthly_log_id', monthlyLogId)
    .eq('transaction_type', 'Charge')
    .ilike('memo', '%management fee%');

  const total = (transactions || []).reduce((sum, tx) => sum + Math.abs(tx.total_amount || 0), 0);

  return {
    amount: total,
    source: 'legacy',
  };
}

/**
 * Get legacy service list from new catalog
 */
export async function getLegacyServiceList(params: {
  propertyId: string;
  unitId?: string | null;
  db?: TypedSupabaseClient;
}): Promise<string[]> {
  const { propertyId, unitId, db = supabaseAdmin } = params;

  const { data: propertyRow } = await db
    .from('properties')
    .select('org_id, service_assignment')
    .eq('id', propertyId)
    .maybeSingle();

  const orgId = propertyRow?.org_id ?? null;
  if (!orgId) return [];

  const wantsUnitLevel = propertyRow?.service_assignment === 'Unit Level';

  const loadAssignment = async (scope: 'unit' | 'property') => {
    const query = db
      .from('service_plan_assignments')
      .select('id, plan_id')
      .eq('org_id', orgId)
      .is('effective_end', null)
      .order('effective_start', { ascending: false })
      .limit(1);

    const scoped =
      scope === 'unit' && unitId
        ? query.eq('unit_id', unitId)
        : query.eq('property_id', propertyId).is('unit_id', null);

    const { data } = await scoped.maybeSingle();
    return data ?? null;
  };

  const unitAssignment = unitId ? await loadAssignment('unit') : null;
  const propertyAssignment = await loadAssignment('property');
  const assignment = wantsUnitLevel ? unitAssignment : propertyAssignment;
  const effectiveAssignment = assignment ?? unitAssignment ?? propertyAssignment;

  if (!effectiveAssignment?.plan_id) return [];

  const planId = String(effectiveAssignment.plan_id);
  const assignmentId = effectiveAssignment.id ? String(effectiveAssignment.id) : null;

  const { data: planRow } = await db.from('service_plans').select('name').eq('id', planId).maybeSingle();
  const planName = planRow?.name ? String(planRow.name) : null;
  const isALaCarte = (planName || '').trim().toLowerCase() === 'a-la-carte';

  let offeringIds: string[] = [];
  if (isALaCarte && assignmentId) {
    const { data: rows } = await db
      .from('service_offering_assignments')
      .select('offering_id, is_active')
      .eq('assignment_id', assignmentId);
    offeringIds = (rows || [])
      .filter((r: any) => r?.is_active !== false)
      .map((r: any) => String(r.offering_id))
      .filter(Boolean);
  } else {
    const { data: rows } = await db
      .from('service_plan_services')
      .select('offering_id')
      .eq('plan_id', planId);
    offeringIds = (rows || []).map((r: any) => String(r.offering_id)).filter(Boolean);
  }

  if (!offeringIds.length) return [];

  const { data: offerings } = await db
    .from('service_offerings')
    .select('id, name')
    .in('id', offeringIds);

  return (offerings || []).map((o: any) => String(o.name || '')).filter(Boolean);
}

/**
 * Get legacy fee calculation (uses old fee logic)
 */
export async function getLegacyFeeCalculation(params: {
  propertyId: string;
  unitId?: string | null;
  monthlyLogId: string;
  db?: TypedSupabaseClient;
}): Promise<number> {
  const { monthlyLogId, db = supabaseAdmin } = params;
  const result = await readServiceFeeDual({ monthlyLogId, db });
  return result.amount;
}

/**
 * Convert legacy config to new format
 */
export async function convertLegacyToNew(params: {
  propertyId: string;
  unitId?: string | null;
  db?: TypedSupabaseClient;
}): Promise<void> {
  const { propertyId, unitId, db: _db = supabaseAdmin } = params;

  // This is handled by the migration script (Phase 7.1)
  // This function is for programmatic conversion if needed
  logger.info({ propertyId, unitId }, 'Legacy config conversion (handled by migration)');
}

/**
 * Check if new service catalog is enabled
 */
export function isNewServiceCatalogEnabled(): boolean {
  return true;
}
