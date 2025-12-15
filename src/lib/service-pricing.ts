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
import type { Database } from '@/types/database';

type ServicePlanEnum = Database['public']['Enums']['service_plan_enum'];

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
  created_at?: string;
  updated_at?: string;
}

export interface PlanDefaultPricing {
  service_plan: ServicePlanEnum;
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
  servicePlan: ServicePlanEnum | null;
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
  servicePlan: ServicePlanEnum | null;
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

  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  const invalidRange =
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate < startDate;

  if (invalidRange) {
    logger.warn(
      { propertyId, unitId, offeringId, periodStart, periodEnd },
      'Invalid period range for service fee calculation',
    );
    return {
      amount: 0,
      calculationMethod: 'invalid_period_range',
    };
  }

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

  const isPlanDefault = (p: ServicePricingConfig | PlanDefaultPricing): p is PlanDefaultPricing =>
    'default_freq' in p;

  const billingBasis = pricing.billing_basis;
  const rate = isPlanDefault(pricing) ? pricing.default_rate : pricing.rate;
  const minAmount = pricing.min_amount ?? null;
  const maxAmount = pricing.max_amount ?? null;
  const minMonthlyFee = pricing.min_monthly_fee ?? null;
  const markupPct = pricing.markup_pct ?? null;
  const markupPctCap = pricing.markup_pct_cap ?? null;
  const hourlyRate = pricing.hourly_rate ?? null;
  const hourlyMinHours = pricing.hourly_min_hours ?? null;

  // Calculate based on billing basis
  switch (billingBasis) {
    case 'per_property':
      calculatedAmount = rate || 0;
      calculationMethod = 'per_property_flat';
      break;

    case 'per_unit':
      calculatedAmount = rate || 0;
      calculationMethod = 'per_unit_flat';
      break;

    case 'percent_rent': {
      // Handle percentage of rent
      if (!leaseRentAmount || leaseRentAmount <= 0) {
        // No active lease or zero rent
        if (minMonthlyFee && minMonthlyFee > 0) {
          calculatedAmount = minMonthlyFee;
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
      const percentage = rate || (pricing as PlanDefaultPricing).plan_fee_percent || 0;
      calculatedAmount = (rentBaseAmount * percentage) / 100;

      // Apply min_monthly_fee if calculated amount is below minimum
      if (minMonthlyFee && minMonthlyFee > 0 && calculatedAmount < minMonthlyFee) {
        calculatedAmount = minMonthlyFee;
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

      const markup = markupPct || 0;
      const markupCap = markupPctCap || null;

      calculatedAmount = (jobCost * markup) / 100;

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

      const hourlyRateValue = hourlyRate || 0;
      const minHours = hourlyMinHours || 0;
      const billableHours = Math.max(hoursWorked, minHours);

      calculatedAmount = billableHours * hourlyRateValue;
      calculationMethod = minHours > hoursWorked ? 'hourly_with_minimum' : 'hourly';
      break;
    }

    case 'one_time':
      calculatedAmount = rate || 0;
      calculationMethod = 'one_time_flat';
      break;

    default:
      calculatedAmount = 0;
      calculationMethod = 'unknown_basis';
  }

  // Apply min/max caps
  if (minAmount && minAmount > 0 && calculatedAmount < minAmount) {
    calculatedAmount = minAmount;
    appliedMinFee = true;
  }

  if (maxAmount && maxAmount > 0 && calculatedAmount > maxAmount) {
    calculatedAmount = maxAmount;
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

export interface ServicePricingPreview {
  rate: number | null;
  billing_frequency: BillingFrequency | string;
  min_amount: number | null;
  max_amount: number | null;
  billing_basis?: BillingBasis;
  effective_start?: string;
  effective_end?: string | null;
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
  const deduplicated = (data || []).reduce<ServicePricingConfig[]>((acc, item) => {
    const existing = acc.find(
      (existingItem: ServicePricingConfig) => existingItem.offering_id === item.offering_id,
    );
    if (!existing || new Date(item.effective_start) > new Date(existing.effective_start)) {
      if (existing) {
        const index = acc.indexOf(existing);
        acc[index] = item as ServicePricingConfig;
      } else {
        acc.push(item as ServicePricingConfig);
      }
    }
    return acc;
  }, []);

  return deduplicated;
}
