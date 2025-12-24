import { supabase as supa, supabaseAdmin } from '@/lib/db'
import { getOrgGlSettingsOrThrow } from './gl-settings'
import { createCharge } from './posting-service'
import { createHash } from 'crypto'

type Recurring = {
  id: string
  lease_id: number
  frequency: 'Monthly' | 'Weekly' | 'Biweekly' | 'Quarterly' | 'Annually' | 'OneTime'
  amount: number
  memo?: string | null
  start_date?: string | null
  end_date?: string | null
}

type LeaseMini = { id: number; org_id: string; payment_due_day: number | null; lease_from_date: string | null; rent_amount: number | null }

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10)
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

export async function generateRecurringCharges(daysHorizon = 60) {
  const db = supabaseAdmin || supa
  const today = new Date()
  const horizon = addDays(today, daysHorizon)

  // Pull templates and leases
  const { data: recurs, error: rErr } = await db.from('recurring_transactions').select('id, lease_id, frequency, amount, memo, start_date, end_date')
  if (rErr) throw rErr
  if (!recurs || recurs.length === 0) return { created: 0 }

  let created = 0
  for (const r of recurs as Recurring[]) {
    // Fetch lease
    const { data: lease, error: lErr } = await db.from('lease').select('id, org_id, payment_due_day, lease_from_date, rent_amount').eq('id', r.lease_id).maybeSingle()
    if (lErr || !lease) continue

    const l = lease as LeaseMini
    const hash = stableTemplateHash(r)
    const occurrences = computeOccurrences(r, l, today, horizon)
    if (occurrences.length === 0) continue

    const gl = await getOrgGlSettingsOrThrow(l.org_id)
    for (const date of occurrences) {
      const idem = `recur:${l.id}:${date}:${hash}`
      const { data: existing } = await db.from('transactions').select('id').eq('idempotency_key', idem).maybeSingle()
      if (existing?.id) continue

      await createCharge({
        lease_id: l.id,
        date,
        memo: r.memo || 'Recurring charge',
        idempotency_key: idem,
        lines: [
          { gl_account_id: gl.ar_lease, amount: r.amount, dr_cr: 'DR' },
          { gl_account_id: gl.rent_income, amount: r.amount, dr_cr: 'CR' },
        ],
      })
      created += 1
    }
  }

  return { created }
}

function computeOccurrences(r: Recurring, l: LeaseMini, from: Date, to: Date): string[] {
  const dates: string[] = []
  // Determine start anchor
  let cur: Date
  if (r.start_date) {
    cur = new Date(r.start_date + 'T00:00:00Z')
  } else if (l.payment_due_day && l.lease_from_date) {
    const start = new Date(l.lease_from_date + 'T00:00:00Z')
    // Next payment_due_day on/after lease_from_date
    const maxDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
    const anchoredDay = Math.min(l.payment_due_day, maxDay)
    const tentative = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), anchoredDay))
    cur = tentative < start ? addMonthsClamp(tentative, 1, l.payment_due_day) : tentative
  } else {
    cur = from
  }

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
      case 'Biweekly': cur = addDays(cur, 14); break
      case 'Quarterly': cur = addMonthsClamp(cur, 3, cur.getUTCDate()); break
      case 'Annually': cur = addMonthsClamp(cur, 12, cur.getUTCDate()); break
      default: cur = addMonthsClamp(cur, 1, l.payment_due_day || cur.getUTCDate()); break
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
