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

// Feature flag check
const USE_NEW_SERVICE_CATALOG = process.env.USE_NEW_SERVICE_CATALOG === 'true';

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
  if (USE_NEW_SERVICE_CATALOG && offeringId) {
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
        // Determine source basis from caller or offering billing_basis
        let basis: BillingBasis = sourceBasis ?? 'percent_rent';
        if (!sourceBasis) {
          const { data: offering } = await db
            .from('service_offerings')
            .select('billing_basis')
            .eq('id', offeringId)
            .maybeSingle();
          if (offering?.billing_basis) {
            basis = offering.billing_basis;
          } else if (!planId) {
            basis = 'per_property';
          }
        }

        // Avoid duplicate billing event (uniqueness constraint)
        const billingEventsQuery = db
          .from('billing_events')
          .select('id')
          .eq('org_id', property.org_id)
          .eq('period_start', monthlyLog.period_start)
          .eq('offering_id', offeringId)
          .eq('property_id', propertyId);

        if (unitId) {
          billingEventsQuery.eq('unit_id', unitId);
        } else {
          billingEventsQuery.is('unit_id', null);
        }

        const { data: existing } = await billingEventsQuery.maybeSingle();

        if (existing?.id) {
          billingEventId = existing.id;
        } else {
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
                amount,
                source_basis: basis,
                rent_basis: rentBasis ?? null,
                rent_amount: rentAmount ?? null,
                calculated_at: new Date().toISOString(),
              },
              { onConflict: 'org_id,period_start,offering_id,property_id,unit_id' },
            )
            .select('id')
            .single();

          if (beError) {
            logger.error({ error: beError }, 'Error creating billing event (dual-write)');
            // Continue anyway - don't fail the transaction
          } else {
            billingEventId = billingEvent?.id;
          }
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

  if (USE_NEW_SERVICE_CATALOG) {
    // Try to read from billing_events
    const { data: matchingTransaction } = await db
      .from('transactions')
      .select('id')
      .eq('monthly_log_id', monthlyLogId)
      .eq('transaction_type', 'Charge')
      .ilike('memo', '%management fee%')
      .limit(1)
      .maybeSingle()

    const transactionIdForQuery = matchingTransaction?.id ?? ''

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

  if (USE_NEW_SERVICE_CATALOG) {
    // Get active offerings from property_service_pricing
    const pricingQuery = db
      .from('property_service_pricing')
      .select('offering_id, service_offerings(code)')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .is('effective_end', null);

    const { data: pricing } = unitId
      ? await pricingQuery.eq('unit_id', unitId)
      : await pricingQuery.is('unit_id', null);

    if (pricing && pricing.length > 0) {
      type PricingRow = {
        offering_id: string;
        service_offerings: { code?: string | null } | null;
      };

      const pricingRows = pricing as PricingRow[];

      return pricingRows
        .map((p) => {
          const code = p.service_offerings?.code || null;
          return (code && OFFERING_TO_LEGACY_MAPPING[code]) || null;
        })
        .filter(Boolean) as string[];
    }
  }

  // Fall back to legacy fields
  if (unitId) {
    const { data: unit } = await db
      .from('units')
      .select('active_services')
      .eq('id', unitId)
      .single();

    if (unit?.active_services) {
      try {
        return JSON.parse(unit.active_services);
      } catch {
        return unit.active_services.split(',').map((s: string) => s.trim());
      }
    }
  } else {
    const { data: property } = await db
      .from('properties')
      .select('active_services')
      .eq('id', propertyId)
      .single();

    const services = property?.active_services as unknown;
    if (Array.isArray(services)) {
      return services as string[];
    }
    if (services) {
      try {
        return JSON.parse(services as string);
      } catch {
        return String(services)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    }
    return [];
  }

  return [];
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
  const { propertyId, unitId, monthlyLogId, db = supabaseAdmin } = params;

  if (!USE_NEW_SERVICE_CATALOG) {
    // Use legacy calculation
    const serviceAssignment = (
      await db
        .from('properties')
        .select('service_assignment, fee_type, fee_percentage, fee_dollar_amount')
        .eq('id', propertyId)
        .single()
    )?.data;

    const usePropertyLevel =
      serviceAssignment?.service_assignment === 'Property Level' ||
      serviceAssignment?.service_assignment === null;

    let feeAmount: number | null = null;

    if (usePropertyLevel) {
      if (serviceAssignment?.fee_type === 'Percentage') {
        // Calculate from rent (legacy logic)
        const { data: monthlyLog } = await db
          .from('monthly_logs')
          .select('charges_amount')
          .eq('id', monthlyLogId)
          .single();

        const rentAmount = monthlyLog?.charges_amount || 0;
        const percentage = serviceAssignment?.fee_percentage || 0;
        feeAmount = (rentAmount * percentage) / 100;
      } else {
        feeAmount = serviceAssignment?.fee_dollar_amount || null;
      }
    } else {
      if (!unitId) {
        return 0;
      }

      const { data: unit } = await db
        .from('units')
        .select('fee_type, fee_percent, fee_dollar_amount')
        .eq('id', unitId)
        .single();

      if (unit?.fee_type === 'Percentage') {
        const { data: monthlyLog } = await db
          .from('monthly_logs')
          .select('charges_amount')
          .eq('id', monthlyLogId)
          .single();

        const rentAmount = monthlyLog?.charges_amount || 0;
        const percentage = unit?.fee_percent || 0;
        feeAmount = (rentAmount * percentage) / 100;
      } else {
        feeAmount = unit?.fee_dollar_amount || null;
      }
    }

    return feeAmount || 0;
  }

  // When feature flag is on, use new calculation
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
  return USE_NEW_SERVICE_CATALOG;
}
