export type BillingFrequency =
  | 'monthly'
  | 'annually'
  | 'one_time'
  | 'per_event'
  | 'per_job'
  | 'quarterly';

export interface CalculateServiceFeeParams {
  propertyId: string;
  unitId?: string | null;
  offeringId: string;
  servicePlan: string | null;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
}

export interface CalculateServiceFeeResult {
  amount: number;
  calculationMethod: string;
  rentBase?: number;
  appliedMinFee?: boolean;
  appliedMaxCap?: boolean;
}

/**
 * Service-level billing has been removed in favor of plan-fee only billing.
 * This stub remains so callers can short-circuit without touching per-service tables.
 */
export async function calculateServiceFee(
  params: CalculateServiceFeeParams,
): Promise<CalculateServiceFeeResult> {
  const { propertyId, unitId, offeringId, periodStart, periodEnd } = params;
  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  const invalidRange =
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate < startDate;

  if (invalidRange) {
    console.warn(
      { propertyId, unitId, offeringId, periodStart, periodEnd },
      'Invalid period range for service fee calculation',
    );
  }

  return {
    amount: 0,
    calculationMethod: 'plan_managed_only',
    rentBase: undefined,
    appliedMinFee: false,
    appliedMaxCap: false,
  };
}
