import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  computeNextRunDate,
  todayInTimezone,
  type RecurringBillSchedule,
} from '@/types/recurring-bills';

describe('recurring bills scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('respects Monday-based weekly schedules in org timezone', () => {
    // Set system time to Tuesday 2025-01-07 UTC (Monday-based week)
    vi.setSystemTime(new Date('2025-01-07T12:00:00Z'));
    const schedule: RecurringBillSchedule = {
      frequency: 'Weekly',
      day_of_week: 1, // Monday
      start_date: '2025-01-06', // Monday
      end_date: null,
      status: 'active',
      next_run_date: null,
      last_generated_at: null,
    };

    const next = computeNextRunDate(schedule, 'America/New_York');
    expect(next).toBe('2025-01-13'); // next Monday
  });

  it('applies rollover for month-end correctly', () => {
    vi.setSystemTime(new Date('2025-02-01T12:00:00Z'));
    const schedule: RecurringBillSchedule = {
      frequency: 'Monthly',
      day_of_month: 31,
      start_date: '2025-01-31',
      end_date: null,
      status: 'active',
      rollover_policy: 'last_day',
      next_run_date: null,
      last_generated_at: null,
    };

    const next = computeNextRunDate(schedule, 'America/New_York');
    expect(next).toBe('2025-02-28'); // February clamps to last day
  });

  it('derives today in org timezone', () => {
    // 2 AM UTC on Jan 1 is still Dec 31 in Eastern
    vi.setSystemTime(new Date('2025-01-01T02:00:00Z'));
    const easternToday = todayInTimezone('America/New_York');
    expect(easternToday).toBe('2024-12-31');
  });
});
