import { supabase as supa, supabaseAdmin } from '@/lib/db'
import { getOrgGlSettingsOrThrow } from './gl-settings'
import { createCharge } from './posting-service'
import { createHash } from 'crypto'
import { arService } from './ar-service'
import type { ChargeType } from '@/types/ar'

type Recurring = {
  id: string
  lease_id: number
  frequency:
    | 'Monthly'
    | 'Weekly'
    | 'Biweekly'
    | 'Every2Weeks'
    | 'Quarterly'
    | 'Yearly'
    | 'Annually'
    | 'Every2Months'
    | 'Every6Months'
    | 'Daily'
    | 'OneTime'
  amount: number
  memo?: string | null
  start_date?: string | null
  end_date?: string | null
}

type LeaseMini = { id: number; org_id: string; payment_due_day: number | null; lease_from_date: string | null; rent_amount: number | null }

type GenerateRecurringOptions = {
  leaseId?: number
  ensureFirstOccurrence?: boolean
}

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfDayUtc(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function addDays(d: Date, days: number) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  x.setUTCDate(x.getUTCDate() + days)
  return x
}

function addMonthsClamp(d: Date, months: number, day?: number) {
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()
  const base = new Date(Date.UTC(year, month + months, 1))
  const targetDay = day ?? d.getUTCDate()
  const maxDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate()
  base.setUTCDate(Math.min(targetDay, maxDay))
  return base
}

function stableTemplateHash(r: Recurring) {
  const s = JSON.stringify({ f: r.frequency, a: r.amount, m: r.memo || '', s: r.start_date || '', e: r.end_date || '' })
  return createHash('sha1').update(s).digest('hex').slice(0, 12)
}

function resolveAnchorDate(r: Recurring, l: LeaseMini, fallback: Date) {
  if (r.start_date) {
    return new Date(r.start_date + 'T00:00:00Z')
  }

  if (l.payment_due_day && l.lease_from_date) {
    const start = new Date(l.lease_from_date + 'T00:00:00Z')
    const maxDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
    const anchoredDay = Math.min(l.payment_due_day, maxDay)
    const tentative = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), anchoredDay))
    return tentative < start ? addMonthsClamp(tentative, 1, l.payment_due_day) : tentative
  }

  return startOfDayUtc(fallback)
}

function computeFirstOccurrence(r: Recurring, l: LeaseMini, from: Date): string | null {
  try {
    return fmtDate(resolveAnchorDate(r, l, from))
  } catch {
    return null
  }
}

async function fetchChargeSchedules(
  db: typeof supabaseAdmin,
  today: Date,
  horizon: Date,
  leaseId?: number,
): Promise<ChargeSchedule[]> {
  const todayStr = fmtDate(today)
  const horizonStr = fmtDate(horizon)
  let query = db
    .from('charge_schedules')
    .select(
      'id, org_id, lease_id, gl_account_id, charge_type, amount, frequency, start_date, end_date, max_occurrences, description, timezone, is_active',
    )
    .eq('is_active', true)
    .lte('start_date', horizonStr)
    .or(`end_date.is.null,end_date.gte.${todayStr}`)

  if (typeof leaseId === 'number' && Number.isFinite(leaseId)) {
    query = query.eq('lease_id', leaseId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ChargeSchedule[]
}

async function processChargeSchedule(schedule: ChargeSchedule, from: Date, to: Date): Promise<number> {
  if (!schedule.is_active) return 0

  const db = supabaseAdmin || supa
  const { data: existingRows } = await db
    .from('charges')
    .select('id, due_date')
    .eq('charge_schedule_id', schedule.id)

  const existingDates = new Set<string>((existingRows ?? []).map((r) => r.due_date as string))
  const existingCount = existingRows?.length ?? 0
  const dates = computeScheduleOccurrences(schedule, from, to, existingCount)

  let created = 0
  for (const date of dates) {
    if (existingDates.has(date)) continue
    const externalId = `charge_schedule:${schedule.id}:${date}`
    try {
      await arService.createChargeWithReceivable({
        leaseId: schedule.lease_id,
        chargeType: schedule.charge_type,
        amount: schedule.amount,
        dueDate: date,
        description: schedule.description ?? null,
        memo: schedule.description ?? null,
        source: 'recurring',
        externalId,
        chargeScheduleId: schedule.id,
        transactionDate: date,
        allocations: [
          {
            accountId: schedule.gl_account_id,
            amount: schedule.amount,
          },
        ],
      })
      created += 1
    } catch (error) {
      // Continue processing other schedules even if one fails
      console.error('Failed to create recurring charge', {
        scheduleId: schedule.id,
        leaseId: schedule.lease_id,
        date,
        error,
      })
    }
  }

  return created
}

function computeScheduleOccurrences(
  schedule: ChargeSchedule,
  from: Date,
  to: Date,
  existingCount: number,
): string[] {
  const dates: string[] = []
  const maxOccurrences = schedule.max_occurrences ?? Number.POSITIVE_INFINITY
  const start = new Date(`${schedule.start_date}T00:00:00Z`)
  const endLimit = schedule.end_date ? new Date(`${schedule.end_date}T00:00:00Z`) : to

  if (Number.isNaN(start.getTime())) return dates

  let cur = start
  while (cur <= to && cur <= endLimit && dates.length + existingCount < maxOccurrences) {
    if (cur >= from) {
      dates.push(fmtDate(cur))
    }
    cur = incrementByFrequency(cur, schedule.frequency)
  }

  return dates
}

function incrementByFrequency(date: Date, frequency: ChargeSchedule['frequency']): Date {
  switch (frequency) {
    case 'Weekly':
      return addDays(date, 7)
    case 'Every2Weeks':
      return addDays(date, 14)
    case 'Daily':
      return addDays(date, 1)
    case 'Quarterly':
      return addMonthsClamp(date, 3, date.getUTCDate())
    case 'Yearly':
      return addMonthsClamp(date, 12, date.getUTCDate())
    case 'Every2Months':
      return addMonthsClamp(date, 2, date.getUTCDate())
    case 'Every6Months':
      return addMonthsClamp(date, 6, date.getUTCDate())
    default:
      return addMonthsClamp(date, 1, date.getUTCDate())
  }
}

async function processLegacyRecurring(
  db: typeof supabaseAdmin,
  today: Date,
  horizon: Date,
  leasesWithSchedule: Set<number>,
  options: GenerateRecurringOptions,
) {
  const { leaseId, ensureFirstOccurrence = false } = options

  let query = db
    .from('recurring_transactions')
    .select('id, lease_id, frequency, amount, memo, start_date, end_date')

  if (typeof leaseId === 'number' && Number.isFinite(leaseId)) {
    query = query.eq('lease_id', leaseId)
  }
  const { data: recurs, error: rErr } = await query
  if (rErr) throw rErr
  if (!recurs || recurs.length === 0) return { created: 0 }

  let created = 0
  for (const r of recurs as Recurring[]) {
    if (r.lease_id == null) continue
    if (leasesWithSchedule.has(r.lease_id)) continue

    const { data: lease, error: lErr } = await db
      .from('lease')
      .select('id, org_id, payment_due_day, lease_from_date, rent_amount')
      .eq('id', r.lease_id)
      .maybeSingle()
    if (lErr || !lease || !lease.org_id) continue

    const l = lease as LeaseMini
    const hash = stableTemplateHash(r)
    const occurrences = computeOccurrences(r, l, today, horizon)
    const firstOccurrence = ensureFirstOccurrence ? computeFirstOccurrence(r, l, today) : null
    const dates = occurrences.length === 0 && firstOccurrence ? [firstOccurrence] : occurrences
    if (dates.length === 0) continue

    const gl = await getOrgGlSettingsOrThrow(l.org_id)
    for (const date of dates) {
      const idem = `recur:${l.id}:${date}:${hash}`
      const { data: existing } = await db
        .from('transactions')
        .select('id')
        .eq('idempotency_key', idem)
        .maybeSingle()
      if (existing?.id) continue

      if (r.frequency === 'OneTime') {
        const { data: alreadyPosted } = await db
          .from('transactions')
          .select('id')
          .eq('lease_id', l.id)
          .eq('date', date)
          .limit(1)
          .maybeSingle()
        if (alreadyPosted?.id) continue
      }

      const isDeposit =
        r.frequency === 'OneTime' &&
        typeof r.memo === 'string' &&
        r.memo.toLowerCase().includes('deposit')
      await createCharge({
        lease_id: l.id,
        date,
        memo: r.memo || 'Recurring charge',
        idempotency_key: idem,
        lines: [
          { gl_account_id: gl.ar_lease, amount: r.amount, dr_cr: 'DR' },
          {
            gl_account_id: isDeposit ? gl.tenant_deposit_liability : gl.rent_income,
            amount: r.amount,
            dr_cr: 'CR',
          },
        ],
      })
      created += 1
    }
  }

  return { created }
}

type ChargeSchedule = {
  id: string
  org_id: string
  lease_id: number
  gl_account_id: string
  charge_type: ChargeType
  amount: number
  frequency:
    | 'Monthly'
    | 'Weekly'
    | 'Every2Weeks'
    | 'Quarterly'
    | 'Yearly'
    | 'Every2Months'
    | 'Daily'
    | 'Every6Months'
  start_date: string
  end_date: string | null
  max_occurrences: number | null
  description: string | null
  timezone: string | null
  is_active: boolean | null
}

export async function generateRecurringCharges(daysHorizon = 60, options: GenerateRecurringOptions = {}) {
  const db = supabaseAdmin || supa
  const today = startOfDayUtc(new Date())
  const horizon = addDays(today, daysHorizon)
  const { leaseId } = options

  const schedules = await fetchChargeSchedules(db, today, horizon, leaseId)
  const leasesWithSchedule = new Set<number>(schedules.map((s) => s.lease_id))

  let created = 0
  for (const schedule of schedules) {
    created += await processChargeSchedule(schedule, today, horizon)
  }

  // Legacy fallback: only for leases without charge_schedules
  const legacyResult = await processLegacyRecurring(db, today, horizon, leasesWithSchedule, options)
  created += legacyResult.created

  return { created }
}

function computeOccurrences(r: Recurring, l: LeaseMini, from: Date, to: Date): string[] {
  const dates: string[] = []
  let cur = resolveAnchorDate(r, l, from)

  const endLimit = r.end_date ? new Date(r.end_date + 'T00:00:00Z') : to
  while (cur <= to && cur <= endLimit) {
    if (cur >= from) dates.push(fmtDate(cur))
    // increment by frequency
    switch (r.frequency) {
      case 'OneTime':
        // Single occurrence only; move beyond horizon to stop loop
        cur = addDays(to, 1)
        break
      case 'Weekly': cur = addDays(cur, 7); break
      case 'Biweekly':
      case 'Every2Weeks':
        cur = addDays(cur, 14); break
      case 'Daily':
        cur = addDays(cur, 1); break
      case 'Quarterly':
        cur = addMonthsClamp(cur, 3, cur.getUTCDate()); break
      case 'Annually':
      case 'Yearly':
        cur = addMonthsClamp(cur, 12, cur.getUTCDate()); break
      case 'Every2Months':
        cur = addMonthsClamp(cur, 2, l.payment_due_day || cur.getUTCDate()); break
      case 'Every6Months':
        cur = addMonthsClamp(cur, 6, l.payment_due_day || cur.getUTCDate()); break
      default:
        cur = addMonthsClamp(cur, 1, l.payment_due_day || cur.getUTCDate()); break
    }
  }
  return dates
}

export async function postLateFees() {
  const db = supabaseAdmin || supa
  const today = new Date()
  const fiveDaysAgo = addDays(today, -5)
  const cutoff = fmtDate(fiveDaysAgo)

  // Find candidate rent charges: transaction lines that credit rent_income and are older than cutoff
  // We will fetch by batches per lease to compute fees
  const { data: leases, error: lErr } = await db
    .from('lease')
    .select('id, org_id, rent_amount')
  if (lErr || !leases) return { created: 0 }

  let created = 0
  for (const lease of leases) {
    const org = typeof lease.org_id === 'string' ? lease.org_id : ''
    const gl = await getOrgGlSettingsOrThrow(org)
    if (!gl.late_fee_income) continue // cannot post without target income account

    // Latest past-due rent credit line
    const { data: lines } = await db
      .from('transaction_lines')
      .select('transaction_id, amount, posting_type, gl_account_id, date')
      .eq('lease_id', lease.id)
      .eq('gl_account_id', gl.rent_income)
      .in('posting_type', ['Credit', 'CR'])
      .lte('date', cutoff)
      .order('date', { ascending: false })
      .limit(1)

    if (!lines || lines.length === 0) continue
    const rentLine = lines[0]
    const rentAmount = Math.abs(Number(rentLine.amount || 0)) || Math.abs(Number(lease.rent_amount || 0))
    if (!rentAmount) continue

    const fee = Math.min(rentAmount * 0.05, 50)
    const periodKey = rentLine.date // use the rent charge date as the period reference
    const idem = `latefee:${lease.id}:${periodKey}`
    const { data: existing } = await db.from('transactions').select('id').eq('idempotency_key', idem).maybeSingle()
    if (existing?.id) continue

    await createCharge({
      lease_id: lease.id,
      date: fmtDate(today),
      memo: `Late fee for ${periodKey}`,
      idempotency_key: idem,
      lines: [
        { gl_account_id: gl.ar_lease, amount: fee, dr_cr: 'DR' },
        { gl_account_id: gl.late_fee_income, amount: fee, dr_cr: 'CR' },
      ],
    })
    created += 1
  }

  return { created }
}
