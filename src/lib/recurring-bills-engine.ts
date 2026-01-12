import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getOrgTimezone } from '@/lib/org-timezone';
import type { Database as DatabaseSchema } from '@/types/database';
import {
  type RecurringBillSchedule,
  computeNextRunDate,
  generateIdempotencyKey,
  applyRolloverPolicy,
  type RecurringBillInstanceMetadata,
  getDayOfWeekInTimezone,
  todayInTimezone,
  dateOnlyToUtc,
} from '@/types/recurring-bills';

type TransactionInsert = DatabaseSchema['public']['Tables']['transactions']['Insert'];
type TransactionLineInsert = DatabaseSchema['public']['Tables']['transaction_lines']['Insert'];

type GenerateRecurringBillsOptions = {
  orgId?: string;
};

// Helper: Format date as YYYY-MM-DD
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Helper: Start of day in UTC
function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Helper: Add days
function addDays(d: Date, days: number): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

// Helper: Add months with clamping
function addMonthsClamp(d: Date, months: number, day?: number): Date {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const base = new Date(Date.UTC(year, month + months, 1));
  const targetDay = day ?? d.getUTCDate();
  const maxDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(targetDay, maxDay));
  return base;
}

// Fetch recurring bills (parent bills with active schedules)
async function fetchRecurringBills(
  db: typeof supabaseAdmin,
  today: Date,
  horizon: Date,
  orgId?: string,
): Promise<Array<{
  id: string
  org_id: string
  date: string
  due_date: string | null
  vendor_id: string | null
  reference_number: string | null
  memo: string | null
  status: string | null
  recurring_schedule: any
  is_recurring: boolean
  total_amount: number | null
}>> {
  const todayStr = fmtDate(today);
  const horizonStr = fmtDate(horizon);

  let query = db
    .from('transactions')
    .select('id, org_id, date, due_date, vendor_id, reference_number, memo, status, recurring_schedule, is_recurring, total_amount')
    .eq('transaction_type', 'Bill')
    .eq('is_recurring', true)
    .not('recurring_schedule', 'is', null);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error({ error }, 'Failed to fetch recurring bills');
    return [];
  }

  // Filter for active schedules
  const activeBills = (data ?? []).filter((bill) => {
    const schedule = bill.recurring_schedule as any;
    if (!schedule?.schedule) return false;

    const scheduleData = schedule.schedule as RecurringBillSchedule;
    if (scheduleData.status !== 'active') return false;
    if (scheduleData.end_date && scheduleData.end_date < todayStr) return false;

    return true;
  });

  return activeBills as any[];
}

// Compute next occurrence dates for a schedule
function computeScheduleOccurrences(
  schedule: RecurringBillSchedule,
  from: Date,
  to: Date,
  lastGeneratedAt: string | null,
  nextRunDate: string | null,
  orgTimezone: string,
): string[] {
  const dates: string[] = [];
  const startDate = dateOnlyToUtc(schedule.start_date);
  const endLimit = schedule.end_date ? dateOnlyToUtc(schedule.end_date) : to;

  if (Number.isNaN(startDate.getTime())) return dates;

  // Use last_generated_at or next_run_date as starting point, or start_date
  // Note: last_generated_at is already a timestamp (ISO string), don't append 'T00:00:00Z'
  let currentDate = lastGeneratedAt
    ? new Date(lastGeneratedAt)
    : nextRunDate
      ? dateOnlyToUtc(nextRunDate)
      : startDate;

  // Ensure we're looking forward from 'from'
  if (currentDate < from) {
    currentDate = new Date(from);
  }

  // Generate dates up to horizon
  while (currentDate <= to && currentDate <= endLimit) {
    if (currentDate >= from) {
      dates.push(fmtDate(currentDate));
    }

    // Increment by frequency
    if (schedule.frequency === 'Monthly') {
      currentDate = addMonthsClamp(currentDate, 1, schedule.day_of_month);
    } else if (schedule.frequency === 'Quarterly') {
      const month = schedule.month ?? 1;
      // Find next quarter occurrence
      const currentMonth = currentDate.getUTCMonth() + 1;
      const currentQuarter = Math.floor((currentMonth - 1) / 3);
      const targetQuarter = Math.floor((month - 1) / 3);
      if (currentMonth >= month && currentQuarter === targetQuarter) {
        // Move to next quarter
        currentDate = addMonthsClamp(currentDate, 3, schedule.day_of_month);
      } else {
        // Move to target month in current or next year
        const targetYear = currentDate.getUTCFullYear();
        if (currentMonth > month) {
          currentDate = new Date(Date.UTC(targetYear + 1, month - 1, schedule.day_of_month));
        } else {
          currentDate = new Date(Date.UTC(targetYear, month - 1, schedule.day_of_month));
        }
        // Apply rollover
        const rollover = applyRolloverPolicy(
          currentDate.getUTCFullYear(),
          currentDate.getUTCMonth() + 1,
          schedule.day_of_month,
          schedule.rollover_policy || 'last_day',
        );
        if (rollover) {
          currentDate = new Date(Date.UTC(rollover.year, rollover.month - 1, rollover.day));
        } else {
          break; // skip policy
        }
      }
    } else if (schedule.frequency === 'Yearly') {
      const month = schedule.month ?? 1;
      const currentMonth = currentDate.getUTCMonth() + 1;
      const currentYear = currentDate.getUTCFullYear();
      if (currentMonth >= month) {
        currentDate = new Date(Date.UTC(currentYear + 1, month - 1, schedule.day_of_month));
      } else {
        currentDate = new Date(Date.UTC(currentYear, month - 1, schedule.day_of_month));
      }
      // Apply rollover
      const rollover = applyRolloverPolicy(
        currentDate.getUTCFullYear(),
        currentDate.getUTCMonth() + 1,
        schedule.day_of_month,
        schedule.rollover_policy || 'last_day',
      );
      if (rollover) {
        currentDate = new Date(Date.UTC(rollover.year, rollover.month - 1, rollover.day));
      } else {
        break; // skip policy
      }
    } else if (schedule.frequency === 'Weekly' || schedule.frequency === 'Every2Weeks') {
      // For weekly/biweekly, respect the configured day_of_week (1=Mon..7=Sun)
      const targetDayOfWeek = schedule.day_of_week || 1;
      const daysToAdd = schedule.frequency === 'Every2Weeks' ? 14 : 7;

      const currentDayOfWeek = getDayOfWeekInTimezone(currentDate, orgTimezone); // 1..7
      const jsTargetDay = targetDayOfWeek % 7; // convert Sunday (7) -> 0
      const jsCurrentDay = currentDayOfWeek % 7;

      // Calculate days until next target day
      let daysUntilTarget = (jsTargetDay - jsCurrentDay + 7) % 7;
      if (daysUntilTarget === 0) {
        daysUntilTarget = daysToAdd;
      }

      currentDate = addDays(currentDate, daysUntilTarget);

      // Ensure we're advancing by at least one full cycle from start_date
      const daysSinceStart = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceStart < daysToAdd && currentDate <= to) {
        currentDate = addDays(currentDate, daysToAdd);
      }
    } else {
      // Unknown frequency, stop
      break;
    }
  }

  return dates;
}

// Process a single recurring bill schedule
async function processRecurringBill(
  parentBill: Awaited<ReturnType<typeof fetchRecurringBills>>[0],
  daysHorizon: number,
): Promise<{ generated: number; skipped: number; duplicates: number; errors: number }> {
  const db = supabaseAdmin;
  const schedule = (parentBill.recurring_schedule as any)?.schedule as RecurringBillSchedule | undefined;

  if (!schedule) {
    return { generated: 0, skipped: 1, duplicates: 0, errors: 0 };
  }

  // Skip if parent is voided or deleted
  if (parentBill.status === 'Void' || parentBill.status === 'Deleted') {
    return { generated: 0, skipped: 1, duplicates: 0, errors: 0 };
  }

  // Skip if schedule is paused or ended
  if (schedule.status !== 'active') {
    return { generated: 0, skipped: 1, duplicates: 0, errors: 0 };
  }

  // Check approval state - skip if parent is approved (shouldn't generate children for approved bills)
  const { data: workflowRow } = await db
    .from('bill_workflow')
    .select('approval_state')
    .eq('bill_transaction_id', parentBill.id)
    .maybeSingle();
  const approvalState = (workflowRow as any)?.approval_state ?? 'draft';
  if (approvalState === 'approved') {
    // Don't generate children for approved bills
    return { generated: 0, skipped: 1, duplicates: 0, errors: 0 };
  }

  // Get org timezone
  const orgTimezone = await getOrgTimezone(parentBill.org_id);

  // Compute occurrence dates using org-local "today"
  const todayStr = todayInTimezone(orgTimezone);
  const from = dateOnlyToUtc(todayStr);
  const to = addDays(from, daysHorizon);
  const lastGeneratedAt = schedule.last_generated_at ? schedule.last_generated_at.slice(0, 10) : null;
  const nextRunDate: string | null = schedule.next_run_date ?? null;
  const occurrenceDates = computeScheduleOccurrences(schedule, from, to, lastGeneratedAt, nextRunDate, orgTimezone);

  let generated = 0;
  let skipped = 0;
  let duplicates = 0;
  let errors = 0;

  // Fetch parent bill lines to copy
  const { data: parentLines } = await db
    .from('transaction_lines')
    .select('*')
    .eq('transaction_id', parentBill.id);

  if (!parentLines || parentLines.length === 0) {
    logger.warn({ parentBillId: parentBill.id }, 'Parent bill has no lines, skipping generation');
    return { generated: 0, skipped: 1, duplicates: 0, errors: 0 };
  }

  // Get existing children to determine sequence
  const { data: existingChildren } = await db
    .from('transactions')
    .select('recurring_schedule')
    .eq('transaction_type', 'Bill')
    .eq('is_recurring', false)
    .not('recurring_schedule', 'is', null)
    .like('idempotency_key', `bill_recur:${parentBill.id}:%`);

  const existingInstanceDates = new Set<string>();
  (existingChildren ?? []).forEach((child: any) => {
    const instance = (child.recurring_schedule as any)?.instance;
    if (instance?.instance_date) {
      existingInstanceDates.add(instance.instance_date);
    }
  });

  const nextSequence = (existingChildren?.length ?? 0) + 1;

  // Generate bills for each occurrence date
  for (let i = 0; i < occurrenceDates.length; i++) {
    const instanceDate = occurrenceDates[i];
    const idempotencyKey = generateIdempotencyKey(parentBill.id, instanceDate);

    // Check for existing bill with same idempotency key
    const { data: existing } = await db
      .from('transactions')
      .select('id')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existing) {
      duplicates++;
      continue;
    }

    // Check if instance_date already exists
    if (existingInstanceDates.has(instanceDate)) {
      duplicates++;
      continue;
    }

    try {
      const nowIso = new Date().toISOString();
      const dueDate = parentBill.due_date || instanceDate;

      // Create child bill header
      const childHeader: TransactionInsert = {
        transaction_type: 'Bill',
        date: instanceDate,
        due_date: dueDate,
        vendor_id: parentBill.vendor_id,
        reference_number: parentBill.reference_number
          ? `${parentBill.reference_number}-${nextSequence + i}`
          : null,
        memo: parentBill.memo,
        status: '', // Children start as draft (empty maps to draft state)
        total_amount: parentBill.total_amount ?? 0,
        created_at: nowIso,
        updated_at: nowIso,
        org_id: parentBill.org_id, // Always set org_id from parent
        is_recurring: false, // Children are instances, not templates
        idempotency_key: idempotencyKey,
        recurring_schedule: {
          instance: {
            parent_transaction_id: parentBill.id,
            instance_date: instanceDate,
            sequence: nextSequence + i,
          } as RecurringBillInstanceMetadata,
        },
      };

      const { data: insertedBill, error: insertError } = await db
        .from('transactions')
        .insert(childHeader)
        .select('id')
        .single();

      if (insertError) {
        logger.error({ error: insertError, parentBillId: parentBill.id, instanceDate }, 'Failed to insert child bill');
        errors++;
        continue;
      }

      if (!insertedBill) {
        errors++;
        continue;
      }

      // Copy transaction lines
      const childLines: TransactionLineInsert[] = parentLines.map((line) => ({
        transaction_id: insertedBill.id,
        gl_account_id: line.gl_account_id,
        amount: line.amount,
        posting_type: line.posting_type,
        memo: line.memo,
        account_entity_type: line.account_entity_type,
        account_entity_id: line.account_entity_id,
        date: instanceDate,
        property_id: line.property_id,
        unit_id: line.unit_id,
        buildium_property_id: line.buildium_property_id,
        buildium_unit_id: line.buildium_unit_id,
        buildium_lease_id: line.buildium_lease_id,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      // Copy tags/attachments/allocations if they exist
      // Note: Allocations are handled via property_id/unit_id in transaction_lines (already copied above)
      // Tags and attachments could be copied here if needed:
      // - Files: Query files table with storage_key matching 'bill/${parentBill.id}/%' and copy to child
      // - Tags: Query transaction_tags table (if exists) and copy tags to child
      // For now, we skip copying tags/attachments - they can be added manually to child bills if needed

      const { error: linesError } = await db.from('transaction_lines').insert(childLines);

      if (linesError) {
        logger.error({ error: linesError, childBillId: insertedBill.id }, 'Failed to insert child bill lines');
        // Clean up the header
        await db.from('transactions').delete().eq('id', insertedBill.id);
        errors++;
        continue;
      }

      generated++;
      existingInstanceDates.add(instanceDate);
    } catch (error) {
      logger.error({ error, parentBillId: parentBill.id, instanceDate }, 'Error generating child bill');
      errors++;
    }
  }

  // Update parent schedule: set last_generated_at and recompute next_run_date
  if (generated > 0 || occurrenceDates.length > 0) {
    const lastGeneratedDate = occurrenceDates.length > 0 ? occurrenceDates[occurrenceDates.length - 1] : null;
    const nextRunDate = lastGeneratedDate
      ? computeNextRunDate(schedule, orgTimezone)
      : schedule.next_run_date;

    const updatedSchedule = {
      ...(parentBill.recurring_schedule as any),
      schedule: {
        ...schedule,
        last_generated_at: new Date().toISOString(),
        next_run_date: nextRunDate,
      },
    };

    await db
      .from('transactions')
      .update({ recurring_schedule: updatedSchedule, updated_at: new Date().toISOString() })
      .eq('id', parentBill.id);
  }

  return { generated, skipped, duplicates, errors };
}

// Main export: Generate recurring bills
export async function generateRecurringBills(
  daysHorizon = 60,
  options: GenerateRecurringBillsOptions = {},
): Promise<{
  generated: number;
  skipped: number;
  duplicates: number;
  errors: number;
  orgIds: string[];
}> {
  const db = supabaseAdmin;
  const today = startOfDayUtc(new Date());
  const horizon = addDays(today, daysHorizon);

  const recurringBills = await fetchRecurringBills(db, today, horizon, options.orgId);

  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalDuplicates = 0;
  let totalErrors = 0;
  const orgIds = new Set<string>();

  for (const bill of recurringBills) {
    orgIds.add(bill.org_id);
    const result = await processRecurringBill(bill, daysHorizon);
    totalGenerated += result.generated;
    totalSkipped += result.skipped;
    totalDuplicates += result.duplicates;
    totalErrors += result.errors;
  }

  return {
    generated: totalGenerated,
    skipped: totalSkipped,
    duplicates: totalDuplicates,
    errors: totalErrors,
    orgIds: Array.from(orgIds),
  };
}
