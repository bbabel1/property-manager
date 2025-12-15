import type { Database } from '@/types/database';

export type ServicePlan = Database['public']['Enums']['service_plan_enum'];

const SERVICE_PLAN_VALUES: ServicePlan[] = ['Full', 'Basic', 'A-la-carte', 'Custom'];

export function isServicePlan(value: unknown): value is ServicePlan {
  return typeof value === 'string' && (SERVICE_PLAN_VALUES as readonly string[]).includes(value);
}

export function toServicePlan(value: unknown): ServicePlan | null {
  if (!value) return null;
  return isServicePlan(value) ? value : null;
}

export const SERVICE_PLAN_OPTIONS = SERVICE_PLAN_VALUES;
