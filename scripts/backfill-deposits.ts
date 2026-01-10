#!/usr/bin/env npx tsx
/**
 * Runs the idempotent deposit backfill functions.
 *
 * Usage:
 *   npx tsx scripts/backfill-deposits.ts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function runBackfill(fnName: keyof Database['public']['Functions'], migrationName: string) {
  const { data: marker } = await admin
    .from('deposit_migration_marker')
    .select('migration_name')
    .eq('migration_name', migrationName)
    .maybeSingle()
  if (marker?.migration_name) {
    console.log(`ℹ️  ${migrationName} already completed, skipping`)
    return
  }

  const { data, error } = await admin.rpc(fnName)
  if (error) throw error
  console.log(`✅ ${fnName} processed ${data ?? 0} rows`)
}

async function main() {
  await runBackfill('backfill_deposit_meta_from_transactions', 'backfill_deposit_meta_v1')
  await runBackfill(
    'backfill_deposit_items_from_transaction_payment_transactions',
    'backfill_deposit_items_v1',
  )
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err)
  process.exit(1)
})
