import type { TypedSupabaseClient } from '@/lib/db';

export async function generateServiceBasedTasks(_params: {
  propertyId: string;
  unitId?: string | null;
  monthlyLogId?: string | null;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  db?: TypedSupabaseClient;
}): Promise<{ created: number; skipped: number }> {
  // Per-service automation is disabled; plan-level billing drives management fees.
  return { created: 0, skipped: 0 };
}

export async function generateServiceBasedCharges(_params: {
  propertyId: string;
  unitId?: string | null;
  monthlyLogId: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  servicePlan: string | null;
  db?: TypedSupabaseClient;
}): Promise<{ created: number; skipped: number; totalAmount: number }> {
  // Per-service charge generation has been removed in favor of plan-fee billing.
  return { created: 0, skipped: 0, totalAmount: 0 };
}
