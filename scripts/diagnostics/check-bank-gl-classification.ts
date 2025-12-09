#!/usr/bin/env -S npx tsx
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supa = createClient(url, service)

async function main() {
  const bankNameHints = ['bank', 'checking', 'operating', 'cash', 'sweep']

  const { data: bankUnset, error: bankErr } = await supa
    .from('gl_accounts')
    .select('id, name, is_bank_account, exclude_from_cash_balances')
    .or(bankNameHints.map((h) => `name.ilike.%${h}%`).join(','))

  if (bankErr) throw bankErr

  const flagged: any[] = []
  for (const row of bankUnset || []) {
    const name = (row.name || '').toLowerCase()
    const looksBank = bankNameHints.some((h) => name.includes(h))
    if ((looksBank && row.is_bank_account !== true) || (row.is_bank_account === true && row.exclude_from_cash_balances == null)) {
      flagged.push(row)
    }
  }

  if (flagged.length === 0) {
    console.log('✅ Bank GL classification check passed')
  } else {
    console.warn(`⚠️ Bank GL classification issues found (${flagged.length})`)
    console.table(flagged.slice(0, 20))
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
