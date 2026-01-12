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
  // Week starts on Monday (1 = Monday, 7 = Sunday)
  day_of_week: z.number().int().min(1).max(7),
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
    const startDate = dateOnlyToUtc(schedule.start_date)
    const todayStr = todayInTimezone(orgTimezone)

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
    if (currentDate < dateOnlyToUtc(todayStr)) {
      currentDate = dateOnlyToUtc(todayStr)
    }

    if (schedule.frequency === 'Monthly' || schedule.frequency === 'Quarterly' || schedule.frequency === 'Yearly') {
      return computeNextMonthlyQuarterlyYearlyDate(
        schedule as Extract<RecurringBillSchedule, { frequency: 'Monthly' | 'Quarterly' | 'Yearly' }>,
        currentDate,
        orgTimezone,
      )
    } else {
      // Weekly or Every2Weeks
      return computeNextWeeklyDate(
        schedule as Extract<RecurringBillSchedule, { frequency: 'Weekly' | 'Every2Weeks' }>,
        currentDate,
        orgTimezone,
      )
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

  if (schedule.frequency === 'Monthly') {
    // Try this month first; if already passed, use next month
    let candidate = applyRolloverPolicy(year, month, targetDay, schedule.rollover_policy)
    if (!candidate || new Date(Date.UTC(candidate.year, candidate.month - 1, candidate.day)) <= currentDate) {
      if (month === 12) {
        year += 1
        month = 1
      } else {
        month += 1
      }
      candidate = applyRolloverPolicy(year, month, targetDay, schedule.rollover_policy)
    }
    if (!candidate) return null
    const nextDate = new Date(Date.UTC(candidate.year, candidate.month - 1, candidate.day))
    return nextDate.toISOString().slice(0, 10)
  }

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
  orgTimezone: string,
): string | null {
  const startDate = dateOnlyToUtc(schedule.start_date)
  const targetDayOfWeek = schedule.day_of_week || 1 // 1 = Monday, 7 = Sunday

  // Calculate days to add
  const daysToAdd = schedule.frequency === 'Every2Weeks' ? 14 : 7

  // Find the next occurrence of the target day of week (week starts Monday)
  let nextDate = new Date(currentDate)
  const currentDayOfWeek = getDayOfWeekInTimezone(nextDate, orgTimezone) // 1..7
  const jsTargetDay = targetDayOfWeek % 7 // convert 7->0 for JS Date math
  const jsCurrentDay = currentDayOfWeek % 7

  // Calculate days until next target day
  let daysUntilTarget = (jsTargetDay - jsCurrentDay + 7) % 7
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

// Helper: parse YYYY-MM-DD to a UTC date anchored at noon to reduce TZ drift
export function dateOnlyToUtc(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map((p) => Number.parseInt(p, 10))
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
}

// Helper: get today's date string in a given timezone (YYYY-MM-DD)
export function todayInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(new Date())
}

// Helper: get day of week (1=Monday..7=Sunday) in a given timezone
export function getDayOfWeekInTimezone(date: Date | string, timezone: string): number {
  const d = typeof date === 'string' ? dateOnlyToUtc(date) : date
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(d)
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }
  return map[weekday] || 1
}
