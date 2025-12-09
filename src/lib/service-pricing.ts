/**
 * Service Pricing Calculation Logic
 *
 * Handles pricing calculations for service offerings with support for:
 * - Property/unit-level overrides
 * - Plan-level defaults
 * - Multiple billing bases (per_property, per_unit, percent_rent, job_cost, hourly, one_time)
 * - Effective dating
 * - Edge cases (zero rent, vacant units, multiple leases, no lease)
 */

import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import { logger } from '@/lib/logger';

export type BillingBasis =
  | 'per_property'
  | 'per_unit'
  | 'percent_rent'
  | 'job_cost'
  | 'hourly'
  | 'one_time';
export type BillingFrequency =
  | 'monthly'
  | 'annually'
  | 'one_time'
  | 'per_event'
  | 'per_job'
  | 'quarterly';
export type RentBasis = 'scheduled' | 'billed' | 'collected';
export type BillOn = 'calendar_day' | 'event' | 'job_close' | 'lease_event' | 'time_log';

export interface ServicePricingConfig {
  id?: string;
  property_id: string;
  unit_id?: string | null;
  offering_id: string;
  billing_basis: BillingBasis;
  rate: number | null;
  billing_frequency: BillingFrequency;
  min_amount: number | null;
  max_amount: number | null;
  bill_on: BillOn;
  rent_basis: RentBasis | null;
  min_monthly_fee: number | null;
  markup_pct: number | null;
  markup_pct_cap: number | null;
  hourly_rate: number | null;
  hourly_min_hours: number | null;
  is_active: boolean;
  effective_start: string;
  effective_end: string | null;
}

export interface PlanDefaultPricing {
  service_plan: string;
  offering_id: string;
  billing_basis: BillingBasis;
  default_rate: number | null;
  default_freq: BillingFrequency;
  min_amount: number | null;
  max_amount: number | null;
  bill_on: BillOn;
  rent_basis: RentBasis | null;
  min_monthly_fee: number | null;
  plan_fee_percent: number | null;
  markup_pct: number | null;
  markup_pct_cap: number | null;
  hourly_rate: number | null;
  hourly_min_hours: number | null;
  is_included: boolean;
  is_required: boolean;
}

export interface CalculateServiceFeeParams {
  propertyId: string;
  unitId?: string | null;
  offeringId: string;
  servicePlan: string | null;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  // Context for calculations
  leaseRentAmount?: number | null; // For percent_rent calculations
  jobCost?: number | null; // For job_cost calculations
  hoursWorked?: number | null; // For hourly calculations
  marketRent?: number | null; // For capping multiple leases
  db?: TypedSupabaseClient;
}

export interface CalculateServiceFeeResult {
  amount: number;
  calculationMethod: string;
  rentBase?: number;
  appliedMinFee?: boolean;
  appliedMaxCap?: boolean;
}

/**
 * Get active service pricing configuration for a property/unit
 * Checks property/unit-level overrides first, then falls back to plan defaults
 */
export async function getActiveServicePricing(params: {
  propertyId: string;
  unitId?: string | null;
  offeringId: string;
  servicePlan: string | null;
  effectiveDate?: string; // ISO timestamp, defaults to now
  db?: TypedSupabaseClient;
}): Promise<ServicePricingConfig | PlanDefaultPricing | null> {
  const { propertyId, unitId, offeringId, servicePlan, effectiveDate, db = supabaseAdmin } = params;
  const effective = effectiveDate ? new Date(effectiveDate) : new Date();

  // First, check for property/unit-level override
  let query = db
    .from('property_service_pricing')
    .select('*')
    .eq('property_id', propertyId)
    .eq('offering_id', offeringId)
    .eq('is_active', true)
    .lte('effective_start', effective.toISOString())
    .or(`effective_end.is.null,effective_end.gt.${effective.toISOString()}`)
    .order('effective_start', { ascending: false })
    .limit(1);

  if (unitId) {
    query = query.eq('unit_id', unitId);
  } else {
    query = query.is('unit_id', null);
  }

  const { data: override, error: overrideError } = await query.maybeSingle();

  if (overrideError && overrideError.code !== 'PGRST116') {
    logger.error(
      { error: overrideError, propertyId, unitId, offeringId },
      'Error fetching property service pricing override',
    );
    throw new Error(`Failed to fetch property service pricing: ${overrideError.message}`);
  }

  if (override) {
    return override as ServicePricingConfig;
  }

  // Fall back to plan defaults
  if (servicePlan) {
    const { data: planDefault, error: planError } = await db
      .from('service_plan_default_pricing')
      .select('*')
      .eq('service_plan', servicePlan)
      .eq('offering_id', offeringId)
      .maybeSingle();

    if (planError && planError.code !== 'PGRST116') {
      logger.error(
        { error: planError, servicePlan, offeringId },
        'Error fetching plan default pricing',
      );
      throw new Error(`Failed to fetch plan default pricing: ${planError.message}`);
    }

    if (planDefault) {
      return planDefault as PlanDefaultPricing;
    }
  }

  return null;
}

/**
 * Calculate service fee based on pricing configuration
 * Handles all billing bases and edge cases
 */
export async function calculateServiceFee(
  params: CalculateServiceFeeParams,
): Promise<CalculateServiceFeeResult> {
  const {
    propertyId,
    unitId,
    offeringId,
    servicePlan,
    periodStart,
    periodEnd,
    leaseRentAmount,
    jobCost,
    hoursWorked,
    marketRent,
    db = supabaseAdmin,
  } = params;

  // Get pricing configuration
  const pricing = await getActiveServicePricing({
    propertyId,
    unitId,
    offeringId,
    servicePlan,
    effectiveDate: periodStart,
    db,
  });

  if (!pricing) {
    return {
      amount: 0,
      calculationMethod: 'no_pricing_config',
    };
  }

  let calculatedAmount = 0;
  let calculationMethod = '';
  let rentBase: number | undefined;
  let appliedMinFee = false;
  let appliedMaxCap = false;

  // Calculate based on billing basis
  switch (pricing.billing_basis) {
    case 'per_property':
      calculatedAmount = pricing.rate || 0;
      calculationMethod = 'per_property_flat';
      break;

    case 'per_unit':
      calculatedAmount = pricing.rate || 0;
      calculationMethod = 'per_unit_flat';
      break;

    case 'percent_rent': {
      // Handle percentage of rent
      if (!leaseRentAmount || leaseRentAmount <= 0) {
        // No active lease or zero rent
        if (pricing.min_monthly_fee && pricing.min_monthly_fee > 0) {
          calculatedAmount = pricing.min_monthly_fee;
          calculationMethod = 'percent_rent_min_fee_fallback';
          appliedMinFee = true;
        } else {
          calculatedAmount = 0;
          calculationMethod = 'percent_rent_no_lease';
        }
        break;
      }

      // Cap at market rent if provided (for multiple leases scenario)
      const rentBaseAmount =
        marketRent && marketRent > 0 && leaseRentAmount > marketRent ? marketRent : leaseRentAmount;
      rentBase = rentBaseAmount;

      // Calculate percentage
      const percentage = pricing.rate || (pricing as PlanDefaultPricing).plan_fee_percent || 0;
      calculatedAmount = (rentBaseAmount * percentage) / 100;

      // Apply min_monthly_fee if calculated amount is below minimum
      if (
        pricing.min_monthly_fee &&
        pricing.min_monthly_fee > 0 &&
        calculatedAmount < pricing.min_monthly_fee
      ) {
        calculatedAmount = pricing.min_monthly_fee;
        appliedMinFee = true;
        calculationMethod = 'percent_rent_with_min_fee';
      } else {
        calculationMethod = 'percent_rent';
      }
      break;
    }

    case 'job_cost': {
      // Handle percentage of job cost
      if (!jobCost || jobCost <= 0) {
        calculatedAmount = 0;
        calculationMethod = 'job_cost_no_cost';
        break;
      }

      const markupPct = pricing.markup_pct || 0;
      const markupCap = pricing.markup_pct_cap || null;

      calculatedAmount = (jobCost * markupPct) / 100;

      // Apply markup cap if specified
      if (markupCap && calculatedAmount > markupCap) {
        calculatedAmount = markupCap;
        appliedMaxCap = true;
        calculationMethod = 'job_cost_capped';
      } else {
        calculationMethod = 'job_cost';
      }
      break;
    }

    case 'hourly': {
      // Handle hourly rate
      if (!hoursWorked || hoursWorked <= 0) {
        calculatedAmount = 0;
        calculationMethod = 'hourly_no_hours';
        break;
      }

      const hourlyRate = pricing.hourly_rate || 0;
      const minHours = pricing.hourly_min_hours || 0;
      const billableHours = Math.max(hoursWorked, minHours);

      calculatedAmount = billableHours * hourlyRate;
      calculationMethod = minHours > hoursWorked ? 'hourly_with_minimum' : 'hourly';
      break;
    }

    case 'one_time':
      calculatedAmount = pricing.rate || 0;
      calculationMethod = 'one_time_flat';
      break;

    default:
      calculatedAmount = 0;
      calculationMethod = 'unknown_basis';
  }

  // Apply min/max caps
  if (pricing.min_amount && pricing.min_amount > 0 && calculatedAmount < pricing.min_amount) {
    calculatedAmount = pricing.min_amount;
    appliedMinFee = true;
  }

  if (pricing.max_amount && pricing.max_amount > 0 && calculatedAmount > pricing.max_amount) {
    calculatedAmount = pricing.max_amount;
    appliedMaxCap = true;
  }

  return {
    amount: Math.max(0, calculatedAmount), // Ensure non-negative
    calculationMethod,
    rentBase,
    appliedMinFee,
    appliedMaxCap,
  };
}

/**
 * Get all active service pricing configurations for a property
 * Useful for displaying all configured services
 */
export async function getPropertyServicePricing(
  propertyId: string,
  unitId?: string | null,
  effectiveDate?: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<ServicePricingConfig[]> {
  const effective = effectiveDate ? new Date(effectiveDate) : new Date();

  let query = db
    .from('property_service_pricing')
    .select('*')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .lte('effective_start', effective.toISOString())
    .or(`effective_end.is.null,effective_end.gt.${effective.toISOString()}`)
    .order('effective_start', { ascending: false });

  if (unitId) {
    query = query.eq('unit_id', unitId);
  } else {
    query = query.is('unit_id', null);
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ error, propertyId, unitId }, 'Error fetching property service pricing');
    throw new Error(`Failed to fetch property service pricing: ${error.message}`);
  }

  // Deduplicate by offering_id, keeping the most recent effective_start
  const deduplicated = (data || []).reduce((acc, item) => {
    const existing = acc.find((i) => i.offering_id === item.offering_id);
    if (!existing || new Date(item.effective_start) > new Date(existing.effective_start)) {
      if (existing) {
        const index = acc.indexOf(existing);
        acc[index] = item as ServicePricingConfig;
      } else {
        acc.push(item as ServicePricingConfig);
      }
    }
    return acc;
  }, [] as ServicePricingConfig[]);

  return deduplicated;
}
