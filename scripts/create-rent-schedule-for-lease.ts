import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const leaseIdArg = process.argv[2]
  if (!leaseIdArg) {
    console.error('Usage: pnpm tsx scripts/create-rent-schedule-for-lease.ts <leaseId>')
    process.exit(1)
  }
  const leaseId = Number(leaseIdArg)
  if (!Number.isFinite(leaseId)) {
    console.error('Lease id must be a number')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
  }
  const supabase = createClient(url, key)

  // Load lease
  const { data: lease, error: leaseErr } = await supabase
    .from('lease')
    .select('*')
    .eq('id', leaseId)
    .maybeSingle()
  if (leaseErr || !lease) {
    throw new Error(leaseErr?.message || `Lease ${leaseId} not found`)
  }

  // Check if a schedule already exists
  const { data: existing } = await supabase
    .from('rent_schedules')
    .select('id')
    .eq('lease_id', leaseId)
    .limit(1)
  if (existing && existing.length) {
    console.log(`Lease ${leaseId} already has a rent_schedules record:`, existing[0].id)
    return
  }

  const toDateOnly = (val: any): string | null => {
    if (!val) return null
    const d = new Date(String(val))
    if (Number.isNaN(d.getTime())) return null
    return d.toISOString().slice(0, 10)
  }

  const rentAmount = Number(lease.rent_amount ?? 0)
  if (!rentAmount || Number.isNaN(rentAmount)) {
    throw new Error('Lease has no rent_amount; cannot create schedule')
  }

  const startDate = toDateOnly(lease.lease_from_date)
  const endDate = toDateOnly(lease.lease_to_date)

  // Map to DB enum
  const mapRentCycleToDb = (v: string | null | undefined): string => {
    const s = String(v || '').toLowerCase()
    switch (s) {
      case 'weekly': return 'Weekly'
      case 'biweekly':
      case 'every2weeks': return 'Every2Weeks'
      case 'quarterly': return 'Quarterly'
      case 'annually':
      case 'annual':
      case 'yearly': return 'Yearly'
      case 'every2months': return 'Every2Months'
      case 'daily': return 'Daily'
      case 'every6months': return 'Every6Months'
      default: return 'Monthly'
    }
  }

  const cycle = mapRentCycleToDb((lease as any).rent_cycle ?? null)

  const nowIso = new Date().toISOString()
  const { data: created, error: insErr } = await supabase
    .from('rent_schedules')
    .insert({
      lease_id: leaseId,
      start_date: startDate!,
      end_date: endDate,
      total_amount: rentAmount,
      rent_cycle: cycle as any,
      backdate_charges: false,
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .maybeSingle()

  if (insErr || !created) {
    throw new Error(insErr?.message || 'Insert failed')
  }
  console.log('Created rent_schedule:', created)
}

main().catch((e) => { console.error(e); process.exit(1) })
