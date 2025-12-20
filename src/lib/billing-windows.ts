export type BillingFrequency = 'monthly' | 'weekly' | 'quarterly' | 'annually';

export interface BillingWindow {
  start: string;
  end: string;
}

const format = (date: Date) => date.toISOString().slice(0, 10);

export function generateBillingWindows(
  frequency: BillingFrequency,
  runDate: Date,
): BillingWindow[] {
  const year = runDate.getUTCFullYear();
  const month = runDate.getUTCMonth(); // 0-indexed

  if (frequency === 'monthly') {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0));
    return [{ start: format(start), end: format(end) }];
  }

  if (frequency === 'weekly') {
    // Bill prior month weeks whose Sunday falls in the billed month
    const billedMonth = month - 1;
    const billedYear = billedMonth >= 0 ? year : year - 1;
    const monthIndex = billedMonth >= 0 ? billedMonth : 11;
    const weeks: BillingWindow[] = [];
    const monthStart = new Date(Date.UTC(billedYear, monthIndex, 1));
    const monthEnd = new Date(Date.UTC(billedYear, monthIndex + 1, 0));

    // Start from the Monday of the week containing the 1st of the billed month.
    const cursor = new Date(monthStart);
    const day = cursor.getUTCDay(); // 0=Sun
    const offsetToMonday = day === 0 ? -6 : 1 - day;
    cursor.setUTCDate(cursor.getUTCDate() + offsetToMonday);

    // Include only Mon–Sun weeks whose Sunday falls within the billed month.
    while (cursor <= monthEnd) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setUTCDate(start.getUTCDate() + 6); // Sunday

      if (end.getUTCMonth() === monthIndex && end.getUTCFullYear() === billedYear) {
        weeks.push({ start: format(start), end: format(end) });
      }

      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return weeks;
  }

  if (frequency === 'quarterly') {
    // Only on quarter boundaries, covering prior quarter
    const currentMonth = month;
    const isBoundary = currentMonth % 3 === 0; // Jan/Apr/Jul/Oct
    if (!isBoundary) return [];
    const startMonth = currentMonth - 3;
    const startYear = startMonth >= 0 ? year : year - 1;
    const normalizedStartMonth = startMonth >= 0 ? startMonth : 12 + startMonth;
    const start = new Date(Date.UTC(startYear, normalizedStartMonth, 1));
    const end = new Date(Date.UTC(year, currentMonth, 0));
    return [{ start: format(start), end: format(end) }];
  }

  if (frequency === 'annually') {
    // Only Jan 1 runs covering prior year
    if (month !== 0 || runDate.getUTCDate() !== 1) return [];
    const start = new Date(Date.UTC(year - 1, 0, 1));
    const end = new Date(Date.UTC(year - 1, 11, 31));
    return [{ start: format(start), end: format(end) }];
  }

  return [];
}
