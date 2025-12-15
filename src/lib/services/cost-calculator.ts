/**
 * Service Cost Calculator
 * 
 * Calculates monthly cost estimates from service pricing configurations.
 * Handles different billing frequencies, billing bases, and grouping by category.
 */

import { ServicePricingConfig } from '@/lib/service-pricing';
import { ServiceOffering } from '@/lib/management-service';

type LeaseForEstimate = {
  unit_id?: string | null;
  property_id?: string | null;
  status?: string | null;
  rent_amount?: number | null;
};

type RentContext = {
  rentByUnit: Map<string, number>;
  rentByProperty: Map<string, number>;
};

export interface CostBreakdown {
  category: string;
  monthlyCost: number;
  services: Array<{
    serviceId: string;
    serviceName: string;
    monthlyCost: number;
  }>;
}

export interface MonthlyCostEstimate {
  total: number;
  breakdown: CostBreakdown[];
}

/**
 * Convert billing frequency to monthly multiplier
 */
function getMonthlyMultiplier(frequency: string): number {
  switch (frequency.toLowerCase()) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 1 / 3;
    case 'annually':
      return 1 / 12;
    case 'one_time':
      return 0; // One-time fees don't contribute to monthly estimate
    case 'per_event':
    case 'per_job':
      return 0; // Event-based fees don't contribute to monthly estimate
    default:
      return 1; // Default to monthly
  }
}

/**
 * Calculate monthly cost for a single pricing configuration
 */
function normalizeStatus(status?: string | null): string {
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

function buildRentContext(leases: LeaseForEstimate[] = []): RentContext {
  const rentByUnit = new Map<string, number>();
  const rentByProperty = new Map<string, number>();

  leases.forEach((lease) => {
    if (!lease) return;
    if (normalizeStatus(lease.status) !== 'active') return;

    const rent = Number(lease.rent_amount ?? 0);
    if (!Number.isFinite(rent) || rent <= 0) return;

    const unitId = lease.unit_id ? String(lease.unit_id) : null;
    const propertyId = lease.property_id ? String(lease.property_id) : null;

    if (unitId) {
      rentByUnit.set(unitId, (rentByUnit.get(unitId) || 0) + rent);
    }
    if (propertyId) {
      rentByProperty.set(propertyId, (rentByProperty.get(propertyId) || 0) + rent);
    }
  });

  return { rentByUnit, rentByProperty };
}

function calculateServiceMonthlyCost(
  pricing: ServicePricingConfig,
  rentContext: RentContext,
): number {
  if (!pricing.is_active) {
    return 0;
  }

  // Handle different billing bases
  let baseAmount = 0;

  if (pricing.billing_basis === 'percent_rent') {
    // Use active leases tied to the unit or property for percent-of-rent services
    const unitId = pricing.unit_id ? String(pricing.unit_id) : null;
    const propertyId = pricing.property_id ? String(pricing.property_id) : null;
    const allPropertyRent = Array.from(rentContext.rentByProperty.values()).reduce(
      (sum, rent) => sum + rent,
      0,
    );
    const rentBase = unitId
      ? rentContext.rentByUnit.get(unitId) ?? 0
      : propertyId
        ? rentContext.rentByProperty.get(propertyId) ?? 0
        : allPropertyRent;

    const minMonthlyFee = pricing.min_monthly_fee ?? pricing.min_amount ?? null;
    if (!rentBase || rentBase <= 0) {
      return minMonthlyFee && minMonthlyFee > 0
        ? minMonthlyFee * getMonthlyMultiplier(pricing.billing_frequency)
        : 0;
    }

    baseAmount = ((pricing.rate || 0) * rentBase) / 100;

    if (minMonthlyFee && minMonthlyFee > 0 && baseAmount < minMonthlyFee) {
      baseAmount = minMonthlyFee;
    }
  } else if (pricing.billing_basis === 'hourly') {
    // Hourly requires hours worked - return 0 for estimate
    baseAmount = 0;
  } else if (pricing.billing_basis === 'job_cost') {
    // Job cost varies - return 0 for estimate
    baseAmount = 0;
  } else if (pricing.billing_basis === 'one_time') {
    // One-time fees don't contribute to monthly estimate
    baseAmount = 0;
  } else {
    // Fixed rate (per_property, per_unit)
    baseAmount = pricing.rate || 0;
  }

  // Apply min/max constraints
  if (pricing.min_amount !== null && baseAmount < pricing.min_amount) {
    baseAmount = pricing.min_amount;
  }
  if (pricing.max_amount !== null && baseAmount > pricing.max_amount) {
    baseAmount = pricing.max_amount;
  }

  // Apply monthly multiplier based on frequency
  const multiplier = getMonthlyMultiplier(pricing.billing_frequency);
  return baseAmount * multiplier;
}

/**
 * Calculate monthly cost estimate from pricing configurations
 */
export function calculateMonthlyCost(
  pricingConfigs: ServicePricingConfig[],
  services: ServiceOffering[] = [],
  leases: LeaseForEstimate[] = [],
): MonthlyCostEstimate {
  // Create a map of services by ID for quick lookup
  const servicesMap = new Map<string, ServiceOffering>();
  services.forEach((service) => {
    servicesMap.set(service.id, service);
  });

  const rentContext = buildRentContext(leases);

  // Group by category
  const categoryMap = new Map<string, CostBreakdown>();

  pricingConfigs.forEach((pricing) => {
    const service = servicesMap.get(pricing.offering_id);
    const category = service?.category || 'Other';
    const serviceName = service?.name || 'Unknown Service';
    const monthlyCost = calculateServiceMonthlyCost(pricing, rentContext);

    if (monthlyCost === 0) {
      return; // Skip services with no monthly cost
    }

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category,
        monthlyCost: 0,
        services: [],
      });
    }

    const breakdown = categoryMap.get(category)!;
    breakdown.monthlyCost += monthlyCost;
    breakdown.services.push({
      serviceId: pricing.offering_id,
      serviceName,
      monthlyCost,
    });
  });

  // Convert map to array and calculate total
  const breakdown = Array.from(categoryMap.values());
  const total = breakdown.reduce((sum, cat) => sum + cat.monthlyCost, 0);

  // Sort breakdown by category name
  breakdown.sort((a, b) => a.category.localeCompare(b.category));

  return {
    total,
    breakdown,
  };
}
