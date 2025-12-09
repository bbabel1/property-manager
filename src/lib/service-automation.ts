/**
 * Service Automation Engine
 *
 * Generates recurring tasks and charges based on active service offerings
 * Part of Phase 4.2: Automation Engine Updates
 */

import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getPropertyServicePricing, type ServicePricingConfig } from './service-pricing';
import { calculateServiceFee } from './service-pricing';

export interface AutomationRule {
  id: string;
  offering_id: string;
  rule_type: 'recurring_task' | 'recurring_charge' | 'workflow_trigger';
  frequency: 'monthly' | 'quarterly' | 'annually' | 'on_event' | 'weekly' | 'biweekly';
  task_template: Record<string, unknown> | null;
  charge_template: Record<string, unknown> | null;
  conditions: Record<string, unknown> | null;
  is_active: boolean;
}

export interface AutomationOverride {
  id: string;
  property_id: string;
  unit_id: string | null;
  offering_id: string;
  rule_id: string;
  override_config: Record<string, unknown>;
  is_active: boolean;
}

/**
 * Generate service-based tasks for a property/unit
 * Checks active service offerings and applies automation rules
 */
export async function generateServiceBasedTasks(params: {
  propertyId: string;
  unitId?: string | null;
  monthlyLogId?: string | null;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  db?: TypedSupabaseClient;
}): Promise<{ created: number; skipped: number }> {
  const { propertyId, unitId, monthlyLogId, periodStart, periodEnd, db = supabaseAdmin } = params;

  // Get active service offerings for this property/unit
  const activePricing = await getPropertyServicePricing(
    propertyId,
    unitId || null,
    periodStart,
    db,
  );
  const activeOfferingIds = activePricing
    .filter(
      (p) => p.is_active && (!p.effective_end || new Date(p.effective_end) > new Date(periodStart)),
    )
    .map((p) => p.offering_id);

  if (activeOfferingIds.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Get automation rules for active offerings
  const { data: rules, error: rulesError } = await db
    .from('service_automation_rules')
    .select('*')
    .in('offering_id', activeOfferingIds)
    .eq('is_active', true)
    .eq('rule_type', 'recurring_task');

  if (rulesError) {
    logger.error({ error: rulesError, propertyId, unitId }, 'Error fetching automation rules');
    throw new Error(`Failed to fetch automation rules: ${rulesError.message}`);
  }

  if (!rules || rules.length === 0) {
    return { created: 0, skipped: 0 };
  }

  // Get property/unit overrides
  let query = db
    .from('property_automation_overrides')
    .select('*')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .in('offering_id', activeOfferingIds);

  if (unitId) {
    query = query.eq('unit_id', unitId);
  } else {
    query = query.is('unit_id', null);
  }

  const { data: overrides } = await query;
  const overridesByRule = new Map<string, AutomationOverride>();
  (overrides || []).forEach((override) => {
    overridesByRule.set(override.rule_id, override as AutomationOverride);
  });

  // Generate tasks based on rules
  let created = 0;
  let skipped = 0;

  for (const rule of rules as AutomationRule[]) {
    // Check if rule should run for this period based on frequency
    if (!shouldRunForPeriod(rule.frequency, periodStart, periodEnd)) {
      skipped++;
      continue;
    }

    // Apply override if exists
    const override = overridesByRule.get(rule.id);
    const effectiveRule = override ? applyOverride(rule, override) : rule;

    // Check conditions
    if (
      effectiveRule.conditions &&
      !checkConditions(effectiveRule.conditions, { propertyId, unitId })
    ) {
      skipped++;
      continue;
    }

    // Generate task from template -> insert into tasks table
    if (effectiveRule.task_template) {
      try {
        const taskData = buildTaskFromTemplate(effectiveRule.task_template, {
          propertyId,
          unitId,
          offeringId: rule.offering_id,
          periodStart,
          periodEnd,
        });

        // Check if task already exists (prevent duplicates for this rule/period)
        const { data: existing } = await db
          .from('tasks')
          .select('id')
          .eq('property_id', propertyId)
          .eq('unit_id', unitId || null)
          .eq('monthly_log_rule_id', rule.id)
          .gte('scheduled_date', periodStart)
          .lte('scheduled_date', periodEnd)
          .maybeSingle();

        if (!existing) {
          const scheduledDate =
            taskData.scheduled_date ||
            taskData.due_date ||
            taskData.dueDate ||
            periodEnd ||
            periodStart;

          const { error: insertError } = await db.from('tasks').insert({
            property_id: propertyId,
            unit_id: unitId || null,
            monthly_log_id: monthlyLogId || null,
            monthly_log_rule_id: rule.id,
            source: 'monthly_log',
            subject: taskData.subject || taskData.name || 'Service Task',
            description: taskData.description || null,
            scheduled_date: scheduledDate,
            priority: taskData.priority || 'normal',
            status: taskData.status || 'new',
            category: taskData.category || null,
            task_category_id: taskData.task_category_id || null,
            service_offering_id: rule.offering_id,
          });

          if (insertError) {
            logger.error({ error: insertError, rule }, 'Error creating task from automation rule -> tasks');
            skipped++;
          } else {
            created++;
          }
        } else {
          skipped++;
        }
      } catch (error) {
        logger.error({ error, rule }, 'Error generating task from template');
        skipped++;
      }
    }
  }

  return { created, skipped };
}

/**
 * Generate service-based charges for a property/unit
 * Calculates fees and creates billing_events
 */
export async function generateServiceBasedCharges(params: {
  propertyId: string;
  unitId?: string | null;
  monthlyLogId: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  servicePlan: string | null;
  db?: TypedSupabaseClient;
}): Promise<{ created: number; skipped: number; totalAmount: number }> {
  const {
    propertyId,
    unitId,
    monthlyLogId,
    periodStart,
    periodEnd,
    servicePlan,
    db = supabaseAdmin,
  } = params;

  // Get active service offerings
  const activePricing = await getPropertyServicePricing(
    propertyId,
    unitId || null,
    periodStart,
    db,
  );
  const activeOfferings = activePricing.filter(
    (p) => p.is_active && (!p.effective_end || new Date(p.effective_end) > new Date(periodStart)),
  );

  if (activeOfferings.length === 0) {
    return { created: 0, skipped: 0, totalAmount: 0 };
  }

  // Get automation rules for charges
  const offeringIds = activeOfferings.map((p) => p.offering_id);
  const { data: rules, error: rulesError } = await db
    .from('service_automation_rules')
    .select('*')
    .in('offering_id', offeringIds)
    .eq('is_active', true)
    .eq('rule_type', 'recurring_charge');

  if (rulesError) {
    logger.error({ error: rulesError }, 'Error fetching charge automation rules');
    throw new Error(`Failed to fetch charge automation rules: ${rulesError.message}`);
  }

  // Get property org_id
  const { data: property } = await db
    .from('properties')
    .select('org_id')
    .eq('id', propertyId)
    .single();

  if (!property?.org_id) {
    throw new Error('Property org_id not found');
  }

  // Get lease data for rent calculations
  const { data: lease } = unitId
    ? await db
        .from('lease')
        .select('rent_amount, lease_from_date, lease_to_date')
        .eq('unit_id', unitId)
        .eq('status', 'active')
        .order('lease_from_date', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  // Get market rent
  const { data: unit } = unitId
    ? await db.from('units').select('market_rent').eq('id', unitId).maybeSingle()
    : { data: null };

  let created = 0;
  let skipped = 0;
  let totalAmount = 0;

  // Generate charges for each active offering
  for (const pricing of activeOfferings) {
    // Check if billing event already exists (prevent double-billing)
    const { data: existing } = await db
      .from('billing_events')
      .select('id')
      .eq('org_id', property.org_id)
      .eq('period_start', periodStart)
      .eq('offering_id', pricing.offering_id)
      .eq('property_id', propertyId)
      .eq('unit_id', unitId || null)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    // Calculate fee
    const feeResult = await calculateServiceFee({
      propertyId,
      unitId,
      offeringId: pricing.offering_id,
      servicePlan,
      periodStart,
      periodEnd,
      leaseRentAmount: lease?.rent_amount || null,
      marketRent: unit?.market_rent || null,
      db,
    });

    if (feeResult.amount <= 0) {
      skipped++;
      continue;
    }

    // Create billing_event
    const { error: beError } = await db.from('billing_events').insert({
      org_id: property.org_id,
      property_id: propertyId,
      unit_id: unitId || null,
      offering_id: pricing.offering_id,
      plan_id: servicePlan,
      period_start: periodStart,
      period_end: periodEnd,
      amount: feeResult.amount,
      source_basis: pricing.billing_basis,
      rent_basis: pricing.rent_basis || null,
      rent_amount: feeResult.rentBase || null,
      calculated_at: new Date().toISOString(),
    });

    if (beError) {
      logger.error({ error: beError, pricing }, 'Error creating billing event');
      skipped++;
    } else {
      created++;
      totalAmount += feeResult.amount;
    }
  }

  return { created, skipped, totalAmount };
}

/**
 * Check if rule should run for this period based on frequency
 */
function shouldRunForPeriod(frequency: string, periodStart: string, periodEnd: string): boolean {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  switch (frequency) {
    case 'monthly':
      return true; // Always run for monthly periods
    case 'quarterly':
      // Run if period start is first month of quarter
      return start.getMonth() % 3 === 0 && start.getDate() === 1;
    case 'annually':
      // Run if period start is January 1st
      return start.getMonth() === 0 && start.getDate() === 1;
    case 'weekly':
    case 'biweekly':
      return true; // Run every period
    case 'on_event':
      return false; // Handled by event triggers, not periodic
    default:
      return true;
  }
}

/**
 * Apply override to rule
 */
function applyOverride(rule: AutomationRule, override: AutomationOverride): AutomationRule {
  const config = override.override_config;
  return {
    ...rule,
    frequency: (config.frequency as AutomationRule['frequency']) || rule.frequency,
    task_template: (config.task_template as AutomationRule['task_template']) || rule.task_template,
    charge_template:
      (config.charge_template as AutomationRule['charge_template']) || rule.charge_template,
    conditions: (config.conditions as AutomationRule['conditions']) || rule.conditions,
  };
}

/**
 * Check if conditions are met
 */
function checkConditions(
  conditions: Record<string, unknown>,
  context: { propertyId: string; unitId?: string | null },
): boolean {
  // Simple condition checking - can be extended
  // For now, just return true (all conditions met)
  return true;
}

/**
 * Build task data from template
 */
function buildTaskFromTemplate(
  template: Record<string, unknown>,
  context: {
    propertyId: string;
    unitId?: string | null;
    offeringId: string;
    periodStart: string;
    periodEnd: string;
  },
): Record<string, unknown> {
  // Simple template expansion - can be extended
  return {
    ...template,
    property_id: context.propertyId,
    unit_id: context.unitId || null,
    service_offering_id: context.offeringId,
  };
}
