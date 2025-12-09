#!/usr/bin/env -S npx tsx
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supa = createClient(url, service)

async function main() {
  const { data: badPosting, error: postingErr } = await supa
    .from('transaction_lines')
    .select('id, posting_type')
    .not('posting_type', 'in', '("Debit","Credit")')
    .limit(10)

  const { data: negativeAmounts, error: amtErr } = await supa
    .from('transaction_lines')
    .select('id, amount')
    .lt('amount', 0)
    .limit(10)

  if (postingErr) throw postingErr
  if (amtErr) throw amtErr

  const badCount = badPosting?.length ?? 0
  const negCount = negativeAmounts?.length ?? 0

  if (badCount === 0 && negCount === 0) {
    console.log('✅ Posting type normalization check passed (no non-canonical posting_type or negative amounts)')
  } else {
    console.warn(`⚠️ Found issues: non-canonical posting_type rows=${badCount}, negative amounts=${negCount}`)
    if (badCount) console.warn('Examples (posting_type):', badPosting)
    if (negCount) console.warn('Examples (amount < 0):', negativeAmounts)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
