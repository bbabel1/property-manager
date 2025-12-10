/**
 * Service Cost Calculator
 * 
 * Calculates monthly cost estimates from service pricing configurations.
 * Handles different billing frequencies, billing bases, and grouping by category.
 */

import { ServicePricingConfig } from '@/lib/service-pricing';
import { ServiceOffering } from '@/lib/management-service';

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
function calculateServiceMonthlyCost(
  pricing: ServicePricingConfig,
  service?: ServiceOffering,
): number {
  if (!pricing.is_active) {
    return 0;
  }

  // Handle different billing bases
  let baseAmount = 0;

  if (pricing.billing_basis === 'percent_rent') {
    // Percent of rent requires rent amount - return 0 for estimate
    // In a real scenario, you'd need to fetch actual rent amounts
    baseAmount = 0;
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
): MonthlyCostEstimate {
  // Create a map of services by ID for quick lookup
  const servicesMap = new Map<string, ServiceOffering>();
  services.forEach((service) => {
    servicesMap.set(service.id, service);
  });

  // Group by category
  const categoryMap = new Map<string, CostBreakdown>();

  pricingConfigs.forEach((pricing) => {
    const service = servicesMap.get(pricing.offering_id);
    const category = service?.category || 'Other';
    const serviceName = service?.name || 'Unknown Service';
    const monthlyCost = calculateServiceMonthlyCost(pricing, service);

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

