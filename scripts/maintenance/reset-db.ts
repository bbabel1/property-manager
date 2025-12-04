#!/usr/bin/env -S node --loader tsx
/*
  Reset script for local/staging development.
  - Deletes data from a set of application tables in dependency order.
  - Safety checks prevent accidental production use unless explicitly forced.
  Usage:
    RESET_CONFIRM=YES npx tsx scripts/reset-db.ts [--force] [--tables owners,properties]
*/

import 'dotenv/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceRole)
}

function parseArgs() {
  const args = new Set(process.argv.slice(2))
  const force = args.has('--force')
  const tablesArg = process.argv.find((a) => a.startsWith('--tables='))
  const tables = tablesArg ? tablesArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean) : undefined
  return { force, tables }
}

function assertSafe(force: boolean) {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').toLowerCase()
  const isLocal = url.includes('127.0.0.1') || url.includes('localhost')
  const confirmed = process.env.RESET_CONFIRM === 'YES'
  if (!confirmed && !force) {
    throw new Error('Set RESET_CONFIRM=YES or pass --force to run reset.')
  }
  if (!isLocal && process.env.NODE_ENV === 'production' && !force) {
    throw new Error('Refusing to reset a production/remote DB without --force.')
  }
}

// Ordered deletes (children → parents). Adjust as schema evolves.
const DEFAULT_TABLES_ORDER = [
  // Unified files first (children before parents)
  'file_links',
  'files',
  'lease_contacts',
  'leases',
  'ownerships',
  'units',
  'property_ownerships_cache',
  'owners_list_cache',
  'properties',
  'owners',
  'contacts',
  'tasks',
  'task_history',
  'task_categories',
  'vendors',
  'gl_accounts',
  'transaction_lines',
  'transactions',
  'bank_accounts',
].reverse().reverse() // keep as array literal; placeholder to easily edit in PRs

async function deleteAll(supabase: SupabaseClient, table: string) {
  // Delete all rows; rely on RLS bypass by service role
  const { error, count } = await supabase.from(table).delete({ count: 'estimated' }).neq('id', null)
  if (error) throw new Error(`${table}: ${error.message}`)
  return count
}

async function run() {
  const { force, tables } = parseArgs()
  assertSafe(force)
  const supabase = getAdminClient()

  const order = tables && tables.length ? tables : DEFAULT_TABLES_ORDER
  console.log('Resetting tables (order):', order.join(', '))

  for (const t of order) {
    try {
      const c = await deleteAll(supabase, t)
      console.log(`Cleared ${t} (${c ?? 'unknown'} rows)`) // count may be null depending on config
    } catch (e: any) {
      console.warn(`Skip/failed ${t}:`, e?.message || e)
    }
  }

  console.log('Reset complete.')
}

run().catch((e) => {
  console.error('Reset failed:', e)
  process.exit(1)
})
