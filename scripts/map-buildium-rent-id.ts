import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { createBuildiumClient, defaultBuildiumConfig } from '../src/lib/buildium-client'

async function main() {
  const leaseIdArg = process.argv[2]
  if (!leaseIdArg) {
    console.error('Usage: npx tsx scripts/map-buildium-rent-id.ts <leaseId>')
    process.exit(1)
  }
  const leaseId = Number(leaseIdArg)
  if (!Number.isFinite(leaseId)) {
    throw new Error('leaseId must be a number')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  const supabase = createClient(url, key)

  const { data: lease, error: leaseErr } = await supabase
    .from('lease')
    .select('id, buildium_lease_id')
    .eq('id', leaseId)
    .maybeSingle()
  if (leaseErr || !lease) throw new Error(leaseErr?.message || `Lease ${leaseId} not found`)

  const buildiumLeaseId = Number(lease.buildium_lease_id)
  if (!Number.isFinite(buildiumLeaseId)) throw new Error('Lease has no buildium_lease_id; sync lease first')

  const client = createBuildiumClient(defaultBuildiumConfig)
  const rent = await client.getLeaseRent(buildiumLeaseId)
  const buildiumRentId = (rent as any)?.Id ? Number((rent as any).Id) : null
  if (!buildiumRentId) throw new Error('Buildium rent Id not found on lease')

  // Choose most recent schedule without a buildium id, else fallback to most recent schedule
  const { data: schedules } = await supabase
    .from('rent_schedules')
    .select('id, start_date, buildium_rent_id')
    .eq('lease_id', leaseId)
    .order('start_date', { ascending: false })
  if (!schedules || schedules.length === 0) throw new Error('No local rent_schedules found for lease')

  const target = schedules.find((s: any) => s.buildium_rent_id == null) || schedules[0]

  const { error: updErr } = await supabase
    .from('rent_schedules')
    .update({ buildium_rent_id: buildiumRentId, updated_at: new Date().toISOString() })
    .eq('id', target.id)
  if (updErr) throw updErr

  console.log(`Mapped Buildium rent Id ${buildiumRentId} to schedule ${target.id} for lease ${leaseId}`)
}

main().catch((e) => { console.error(e); process.exit(1) })

