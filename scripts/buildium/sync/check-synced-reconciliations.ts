#!/usr/bin/env npx tsx
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const { data, error } = await admin
    .from('reconciliation_log')
    .select('id, buildium_reconciliation_id, statement_ending_date, ending_balance, is_finished, bank_gl_account_id')
    .order('statement_ending_date', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error:', error)
    process.exit(1)
  }

  console.log(`Found ${data?.length || 0} reconciliation(s):\n`)
  console.log(JSON.stringify(data, null, 2))
}

main().catch(console.error)

