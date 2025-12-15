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
  const { propertyId, unitId, offeringId, effectiveDate, db = supabaseAdmin } = params;

  logger.info({ propertyId, unitId, offeringId, effectiveDate }, 'Handling service deactivation');

  // End pricing configuration
  const { error: pricingError } = await db
    .from('property_service_pricing')
    .update({
      effective_end: effectiveDate,
      is_active: false,
    })
    .eq('property_id', propertyId)
    .eq('offering_id', offeringId)
    .eq('is_active', true)
    .is('effective_end', null)
    .match({ unit_id: unitId ?? null });

  if (pricingError) {
    logger.error({ error: pricingError }, 'Error ending pricing on service deactivation');
    // Don't throw - allow deactivation to proceed
  }

  // Cancel future tasks (set is_active = false or delete)
  const { error: tasksError } = await db
    .from('monthly_log_task_rules')
    .update({ is_active: false })
    .eq('property_id', propertyId)
    .eq('service_offering_id', offeringId)
    .eq('is_active', true)
    .match({ unit_id: unitId ?? null });

  if (tasksError) {
    logger.error({ error: tasksError }, 'Error canceling tasks on service deactivation');
    // Don't throw - allow deactivation to proceed
  }
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
  const { propertyId, unitId, newPlan, oldPlan, effectiveDate, db = supabaseAdmin } = params;

  logger.info(
    { propertyId, unitId, oldPlan, newPlan, effectiveDate },
    'Handling service plan change',
  );

  if (!newPlan) {
    // Plan removed - deactivate all services
    const { data: activePricing } = await db
      .from('property_service_pricing')
      .select('offering_id')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .is('effective_end', null)
      .match({ unit_id: unitId ?? null });

    if (activePricing) {
      for (const pricing of activePricing) {
        await handleServiceDeactivation({
          propertyId,
          unitId,
          offeringId: pricing.offering_id,
          effectiveDate,
          db,
        });
      }
    }
    return;
  }

  // Get plan offerings
  const { data: planOfferings } = await db
    .from('service_plan_offerings')
    .select('offering_id, is_included')
    .eq('service_plan', newPlan)
    .eq('is_included', true);

  if (!planOfferings || planOfferings.length === 0) {
    return;
  }

  const newOfferingIds = new Set(planOfferings.map((po) => po.offering_id));

  // Get current active offerings
  const { data: currentPricing } = await db
    .from('property_service_pricing')
    .select('offering_id')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .is('effective_end', null)
    .match({ unit_id: unitId ?? null });

  const currentOfferingIds = new Set((currentPricing || []).map((p) => p.offering_id));

  // Deactivate offerings not in new plan
  for (const offeringId of currentOfferingIds) {
    if (!newOfferingIds.has(offeringId)) {
      await handleServiceDeactivation({
        propertyId,
        unitId,
        offeringId,
        effectiveDate,
        db,
      });
    }
  }

  // Activate offerings in new plan that aren't currently active
  for (const offeringId of newOfferingIds) {
    if (!currentOfferingIds.has(offeringId)) {
      await handleServiceActivation({
        propertyId,
        unitId,
        offeringId,
        effectiveDate,
        servicePlan: newPlan,
        db,
      });
    }
  }
}
