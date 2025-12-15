import type {
  BillOn,
  BillingBasis,
  BillingFrequency,
  RentBasis,
  ServicePricingConfig,
} from '@/lib/service-pricing';

export type PropertyServicePricingRow = Omit<
  ServicePricingConfig,
  'id' | 'unit_id' | 'created_at' | 'updated_at'
> & {
  id: string;
  unit_id: string | null;
  created_at: string;
  updated_at: string;
};

export interface ServicePlanDefaultPricingRow {
  service_plan: string;
  offering_id: string;
  billing_basis: BillingBasis;
  default_rate: number | null;
  default_freq: BillingFrequency | string;
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
