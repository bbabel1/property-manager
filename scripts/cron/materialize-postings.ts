#!/usr/bin/env -S npx tsx
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { createCharge } from '@/lib/posting-service'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supa = createClient(url, service)

function eom(year:number, month:number) {
  return new Date(year, month+1, 0).getDate()
}

function anchorDate(d: Date, dueDay: number) {
  const dd = Math.min(dueDay, eom(d.getFullYear(), d.getMonth()))
  return new Date(d.getFullYear(), d.getMonth(), dd)
}

async function main() {
  const today = new Date()
  const windowDates = [0,1].map(n => new Date(today.getFullYear(), today.getMonth(), today.getDate()+n).toISOString().slice(0,10))
  // Fetch due schedules for leases; simple: pick payment_due_day and compare to target
  const { data: leases } = await supa.from('lease').select('id, payment_due_day, lease_from_date, lease_to_date, rent_amount')
  if (!leases) return
  for (const l of leases) {
    if (!l.payment_due_day || !l.rent_amount) continue
    const ref = anchorDate(today, l.payment_due_day)
    const dueStr = ref.toISOString().slice(0,10)
    if (!windowDates.includes(dueStr)) continue
    // Create rent charge (idempotent)
    const idem = `rent:${l.id}:${dueStr}`
    try {
      await createCharge({
        lease_id: l.id,
        date: dueStr,
        memo: 'Monthly Rent',
        lines: [
          { gl_account_id: 'AR_LEASE', amount: l.rent_amount, dr_cr: 'DR' },
          { gl_account_id: 'RENT_INCOME', amount: l.rent_amount, dr_cr: 'CR' },
        ],
        idempotency_key: idem,
      })
      console.log(`Posted rent charge for lease ${l.id} on ${dueStr}`)
    } catch (e:any) {
      if (String(e?.message || '').includes('uq_transactions_idem')) continue
      console.error('Failed posting rent', l.id, dueStr, e?.message)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
