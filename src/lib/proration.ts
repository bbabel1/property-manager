// UTC-based, leap-year aware proration helper
// Policy:
// - First-month proration: from lease start date until end of month inclusive
// - Last-month proration: from first of month until lease end date inclusive
// - Amount = monthly * (days_used / days_in_month)

export function daysInUtcMonth(year: number, month0: number): number {
  // month0 is 0-based
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

export function prorationFirstMonth(monthly: number, startIso: string): number {
  const d = new Date(startIso + 'T00:00:00.000Z')
  if (Number.isNaN(d.getTime())) return 0
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const startDay = d.getUTCDate()
  const dim = daysInUtcMonth(y, m)
  const days = dim - startDay + 1
  return round2(monthly * (days / dim))
}

export function prorationLastMonth(monthly: number, endIso: string): number {
  const d = new Date(endIso + 'T00:00:00.000Z')
  if (Number.isNaN(d.getTime())) return 0
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const endDay = d.getUTCDate()
  const dim = daysInUtcMonth(y, m)
  // if end is last day, no proration; else proportional
  if (endDay >= dim) return 0
  const days = endDay
  return round2(monthly * (days / dim))
}

function round2(n: number) { return Math.round(n * 100) / 100 }

