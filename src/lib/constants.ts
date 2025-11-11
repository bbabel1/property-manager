export const MONTHLY_LOG_STAGES = [
  'charges',
  'payments',
  'bills',
  'escrow',
  'management_fees',
  'owner_statements',
  'owner_distributions',
] as const;

export type MonthlyLogStage = (typeof MONTHLY_LOG_STAGES)[number];
