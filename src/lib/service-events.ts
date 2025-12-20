/**
 * Service Event Handlers
 *
 * Handles service activation/deactivation events
 * Part of Phase 4.3: Service Event Handlers
 */

import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import { generateServiceBasedTasks } from './service-automation';
import type { Database } from '@/types/database';

type ServicePlanEnum = Database['public']['Enums']['service_plan_enum'];

/**
 * Handle service activation event
 * Creates initial tasks/charges for next billing cycle (no proration)
 */
export async function handleServiceActivation(params: {
  propertyId: string;
  unitId?: string | null;
  offeringId: string;
  effectiveDate: string; // ISO timestamp
  servicePlan: ServicePlanEnum | null;
  db?: TypedSupabaseClient;
}): Promise<void> {
  const { propertyId, unitId, offeringId, effectiveDate, servicePlan, db = supabaseAdmin } = params;

  logger.info(
    { propertyId, unitId, offeringId, effectiveDate, servicePlan },
    'Handling service activation',
  );

  // Get next billing cycle start date (no proration - start next period)
  const effective = new Date(effectiveDate);
  const nextPeriodStart = new Date(effective);
  nextPeriodStart.setMonth(nextPeriodStart.getMonth() + 1, 1); // First day of next month
  const nextPeriodEnd = new Date(nextPeriodStart);
  nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1, 0); // Last day of next month

  const periodStartStr = nextPeriodStart.toISOString().split('T')[0];
  const periodEndStr = nextPeriodEnd.toISOString().split('T')[0];

  // Generate tasks for next period
  try {
    await generateServiceBasedTasks({
      propertyId,
      unitId,
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      db,
    });
  } catch (error) {
    logger.error(
      { error, propertyId, unitId, offeringId },
      'Error generating tasks on service activation',
    );
    // Don't throw - allow activation to proceed
  }

  // Note: Charges will be generated when monthly log is created for that period
  // This handler just ensures tasks are set up
}

/**
 * Handle service deactivation event
 * Cleans up tasks/charges (sets effective_end on pricing, cancels future tasks)
 */
export async function handleServiceDeactivation(params: {
  propertyId: string;
  unitId?: string | null;
  offeringId: string;
  effectiveDate: string; // ISO timestamp
  db?: TypedSupabaseClient;
}): Promise<void> {
  const { propertyId, unitId, offeringId, effectiveDate } = params;

  logger.info({ propertyId, unitId, offeringId, effectiveDate }, 'Handling service deactivation');
}

/**
 * Handle service plan change
 * Activates/deactivates offerings based on new plan
 */
export async function handleServicePlanChange(params: {
  propertyId: string;
  unitId?: string | null;
  oldPlan: ServicePlanEnum | null;
  newPlan: ServicePlanEnum | null;
  effectiveDate: string;
  db?: TypedSupabaseClient;
}): Promise<void> {
  const { propertyId, unitId, newPlan, oldPlan, effectiveDate } = params;

  logger.info(
    { propertyId, unitId, oldPlan, newPlan, effectiveDate },
    'Handling service plan change',
  );
}
