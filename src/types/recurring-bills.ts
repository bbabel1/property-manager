import { z } from 'zod'

// Canonical frequency values matching existing codebase enum
export type RecurringBillFrequency = 'Monthly' | 'Weekly' | 'Every2Weeks' | 'Quarterly' | 'Yearly'

// Display label mapping for UI (display-only labels mapped at the edge)
export const FREQUENCY_DISPLAY_LABELS: Record<string, RecurringBillFrequency> = {
  Biweekly: 'Every2Weeks',
  Annually: 'Yearly',
}

// Reverse mapping for display
export const FREQUENCY_TO_DISPLAY: Record<RecurringBillFrequency, string> = {
  Monthly: 'Monthly',
  Weekly: 'Weekly',
  Every2Weeks: 'Biweekly',
  Quarterly: 'Quarterly',
  Yearly: 'Annually',
}

// Frequency enum for Zod validation
export const RecurringBillFrequencyEnum = z.enum(['Monthly', 'Weekly', 'Every2Weeks', 'Quarterly', 'Yearly'])

// Date-only string (YYYY-MM-DD)
const ISODateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format')

// Rollover policy enum
export const RolloverPolicyEnum = z.enum(['last_day', 'next_month', 'skip'])

// Schedule status enum
export const ScheduleStatusEnum = z.enum(['active', 'paused', 'ended'])

// Base schedule schema (for Monthly/Quarterly/Yearly)
const MonthlyQuarterlyYearlyScheduleSchema = z.object({
  frequency: z.enum(['Monthly', 'Quarterly', 'Yearly']),
  day_of_month: z.number().int().min(1).max(31),
  month: z.number().int().min(1).max(12).optional(), // Required for Quarterly/Yearly
  rollover_policy: RolloverPolicyEnum.default('last_day'),
  start_date: ISODateString,
  end_date: ISODateString.nullable().optional(),
  status: ScheduleStatusEnum.default('active'),
  // Server-owned fields (client cannot set)
  next_run_date: ISODateString.nullable().optional(),
  last_generated_at: z.string().datetime().nullable().optional(), // ISO timestamp for audit
  ended_at: z.string().datetime().nullable().optional(),
})

// Base schedule schema (for Weekly/Every2Weeks)
const WeeklyEvery2WeeksScheduleSchema = z.object({
  frequency: z.enum(['Weekly', 'Every2Weeks']),
  day_of_week: z.number().int().min(0).max(6), // 0 = Sunday, 6 = Saturday
  start_date: ISODateString,
  end_date: ISODateString.nullable().optional(),
  status: ScheduleStatusEnum.default('active'),
  // Server-owned fields (client cannot set)
  next_run_date: ISODateString.nullable().optional(),
  last_generated_at: z.string().datetime().nullable().optional(), // ISO timestamp for audit
  ended_at: z.string().datetime().nullable().optional(),
})

// Union of schedule schemas with conditional validation
export const RecurringBillScheduleSchema = z
  .discriminatedUnion('frequency', [
    MonthlyQuarterlyYearlyScheduleSchema,
    WeeklyEvery2WeeksScheduleSchema,
  ])
  .superRefine((data, ctx) => {
    // Validate month is required for Quarterly/Yearly
    if ((data.frequency === 'Quarterly' || data.frequency === 'Yearly') && !('month' in data)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'month is required for Quarterly and Yearly frequencies',
        path: ['month'],
      })
    }

    // Validate day_of_month exists for Monthly/Quarterly/Yearly
    if ('day_of_month' in data) {
      const month = 'month' in data && data.month ? data.month : new Date(data.start_date + 'T00:00:00Z').getUTCMonth() + 1
      if (!validateMonthDay(month, data.day_of_month)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Invalid day ${data.day_of_month} for month ${month}`,
          path: ['day_of_month'],
        })
      }
    }

    // Validate end_date > start_date if provided
    if (data.end_date && data.end_date <= data.start_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end_date must be after start_date',
        path: ['end_date'],
      })
    }

    // Block client from setting server-owned fields
    if (data.next_run_date !== undefined && data.next_run_date !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'next_run_date is server-owned and cannot be set by client',
        path: ['next_run_date'],
      })
    }
    if (data.last_generated_at !== undefined && data.last_generated_at !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'last_generated_at is server-owned and cannot be set by client',
        path: ['last_generated_at'],
      })
    }
  })

// Type for schedule (parent bills)
export type RecurringBillSchedule = z.infer<typeof RecurringBillScheduleSchema>

// Child metadata schema (for generated bills)
export const RecurringBillInstanceMetadataSchema = z.object({
  parent_transaction_id: z.string().uuid(),
  instance_date: ISODateString,
  sequence: z.number().int().positive(),
})

export type RecurringBillInstanceMetadata = z.infer<typeof RecurringBillInstanceMetadataSchema>

// Full recurring_schedule JSONB structure (namespaced)
export const RecurringBillScheduleJsonbSchema = z.object({
  schedule: RecurringBillScheduleSchema.optional(),
  instance: RecurringBillInstanceMetadataSchema.optional(),
})

export type RecurringBillScheduleJsonb = z.infer<typeof RecurringBillScheduleJsonbSchema>

// Helper function: Validate month/day combination
export function validateMonthDay(month: number, day: number): boolean {
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false

  const daysInMonth = new Date(Date.UTC(2000, month, 0)).getUTCDate()
  return day <= daysInMonth
}

// Helper function: Apply rollover policy
export function applyRolloverPolicy(
  year: number,
  month: number,
  day: number,
  policy: 'last_day' | 'next_month' | 'skip',
): { year: number; month: number; day: number } | null {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  if (day <= daysInMonth) {
    return { year, month, day }
  }

  switch (policy) {
    case 'last_day':
      return { year, month, day: daysInMonth }
    case 'next_month':
      if (month === 12) {
        return { year: year + 1, month: 1, day }
      }
      return { year, month: month + 1, day }
    case 'skip':
      return null
    default:
      return null
  }
}

// Helper function: Compute next run date
export function computeNextRunDate(
  schedule: RecurringBillSchedule,
  orgTimezone: string = 'America/New_York',
): string | null {
  try {
    const startDate = new Date(schedule.start_date + 'T00:00:00Z')
    // Use org timezone for calculations (default America/New_York)
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)

    // If schedule has ended or is paused, return null
    if (schedule.status === 'ended' || schedule.status === 'paused') {
      return null
    }

    // If end_date has passed, return null
    if (schedule.end_date && schedule.end_date < todayStr) {
      return null
    }

    // Use last_generated_at or next_run_date as starting point if available
    // Note: last_generated_at is already a timestamp (ISO string), don't append 'T00:00:00Z'
    let currentDate = schedule.next_run_date
      ? new Date(schedule.next_run_date + 'T00:00:00Z')
      : schedule.last_generated_at
        ? new Date(schedule.last_generated_at) // Already a timestamp
        : startDate

    // Ensure we're looking forward from today
    if (currentDate < new Date(todayStr + 'T00:00:00Z')) {
      currentDate = new Date(todayStr + 'T00:00:00Z')
    }

    if (schedule.frequency === 'Monthly' || schedule.frequency === 'Quarterly' || schedule.frequency === 'Yearly') {
      return computeNextMonthlyQuarterlyYearlyDate(schedule, currentDate, orgTimezone)
    } else {
      // Weekly or Every2Weeks
      return computeNextWeeklyDate(schedule, currentDate)
    }
  } catch (error) {
    console.error('Error computing next run date:', error)
    return null
  }
}

function computeNextMonthlyQuarterlyYearlyDate(
  schedule: Extract<RecurringBillSchedule, { frequency: 'Monthly' | 'Quarterly' | 'Yearly' }>,
  currentDate: Date,
  orgTimezone: string,
): string | null {
  const currentYear = currentDate.getUTCFullYear()
  const currentMonth = currentDate.getUTCMonth() + 1
  const targetDay = schedule.day_of_month

  // For Quarterly/Yearly, use the specified month
  const targetMonth = schedule.frequency === 'Quarterly' || schedule.frequency === 'Yearly' ? (schedule.month ?? 1) : currentMonth

  // Calculate months to add
  let monthsToAdd = 0
  if (schedule.frequency === 'Quarterly') {
    monthsToAdd = 3
  } else if (schedule.frequency === 'Yearly') {
    monthsToAdd = 12
  } else {
    monthsToAdd = 1
  }

  // Find next occurrence
  let year = currentYear
  let month = currentMonth

  // If we're past the target month for Quarterly/Yearly, move to next cycle
  if ((schedule.frequency === 'Quarterly' || schedule.frequency === 'Yearly') && currentMonth > targetMonth) {
    year += schedule.frequency === 'Yearly' ? 1 : 0
    month = targetMonth
    if (schedule.frequency === 'Quarterly') {
      // Find next quarter
      const quarter = Math.floor((targetMonth - 1) / 3)
      const nextQuarter = (quarter + 1) % 4
      month = nextQuarter * 3 + 1
      if (nextQuarter === 0) year += 1
    }
  } else if (schedule.frequency === 'Monthly') {
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  } else {
    // Quarterly/Yearly and we're at or before target month
    if (currentMonth < targetMonth) {
      month = targetMonth
    } else {
      // Move to next cycle
      if (schedule.frequency === 'Yearly') {
        year += 1
        month = targetMonth
      } else {
        // Quarterly - find next quarter
        const quarter = Math.floor((targetMonth - 1) / 3)
        const nextQuarter = (quarter + 1) % 4
        month = nextQuarter * 3 + 1
        if (nextQuarter === 0) year += 1
      }
    }
  }

  // Apply rollover policy if day doesn't exist in target month
  const rollover = applyRolloverPolicy(year, month, targetDay, schedule.rollover_policy)
  if (!rollover) {
    return null // skip policy
  }

  const nextDate = new Date(Date.UTC(rollover.year, rollover.month - 1, rollover.day))
  return nextDate.toISOString().slice(0, 10)
}

function computeNextWeeklyDate(
  schedule: Extract<RecurringBillSchedule, { frequency: 'Weekly' | 'Every2Weeks' }>,
  currentDate: Date,
): string | null {
  const startDate = new Date(schedule.start_date + 'T00:00:00Z')
  const targetDayOfWeek = schedule.day_of_week

  // Calculate days to add
  const daysToAdd = schedule.frequency === 'Every2Weeks' ? 14 : 7

  // Find the next occurrence of the target day of week
  let nextDate = new Date(currentDate)
  const currentDayOfWeek = nextDate.getUTCDay()

  // Calculate days until next target day
  let daysUntilTarget = (targetDayOfWeek - currentDayOfWeek + 7) % 7
  if (daysUntilTarget === 0) {
    // If today is the target day, move to next occurrence
    daysUntilTarget = daysToAdd
  }

  nextDate.setUTCDate(nextDate.getUTCDate() + daysUntilTarget)

  // Ensure we're at least one full cycle from start_date
  const daysSinceStart = Math.floor((nextDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  if (daysSinceStart < daysToAdd) {
    // Move to next cycle to ensure we're generating future occurrences
    nextDate.setUTCDate(nextDate.getUTCDate() + daysToAdd)
  }

  return nextDate.toISOString().slice(0, 10)
}

// Helper function: Generate idempotency key
export function generateIdempotencyKey(parentTransactionId: string, instanceDate: string): string {
  return `bill_recur:${parentTransactionId}:${instanceDate}`
}

// Helper function: Map display label to canonical frequency
export function mapDisplayLabelToFrequency(displayLabel: string): RecurringBillFrequency | null {
  const canonical = FREQUENCY_DISPLAY_LABELS[displayLabel]
  if (canonical) return canonical

  // If it's already a canonical value, return it
  if (['Monthly', 'Weekly', 'Every2Weeks', 'Quarterly', 'Yearly'].includes(displayLabel)) {
    return displayLabel as RecurringBillFrequency
  }

  return null
}

// Helper function: Map canonical frequency to display label
export function mapFrequencyToDisplayLabel(frequency: RecurringBillFrequency): string {
  return FREQUENCY_TO_DISPLAY[frequency] || frequency
}

