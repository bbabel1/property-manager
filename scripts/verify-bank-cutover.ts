#!/usr/bin/env tsx
/**
 * Phase 6 verification gates for bank account cutover.
 * Run before/after deploy to ensure Buildium sync safety.
 *
 * Checks:
 *  - verify_bank_accounts_backfill: bank GL accounts have required bank payload fields.
 *  - verify_property_links: property operating/deposit links point at bank GL accounts.
 *  - verify_buildium_payload_shape: bank payload fields are present to POST to Buildium.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type CheckFn = (client: ReturnType<typeof getClient>) => Promise<string[]>

function getClient() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run verification.')
  }

  return createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const checks: Record<string, CheckFn> = {
  async verify_bank_accounts_backfill(client) {
    const { data, error } = await client
      .from('gl_accounts')
      .select(
        'id, name, is_bank_account, buildium_gl_account_id, buildium_bank_account_id, bank_account_number, bank_routing_number, bank_country, bank_account_type',
      )
      .eq('is_bank_account', true)

    if (error) return [`gl_accounts fetch failed: ${error.message}`]

    const missingPayload = (data || []).filter(
      (row) =>
        !row.bank_account_number ||
        !row.bank_routing_number ||
        !row.bank_country ||
        !row.bank_account_type,
    )

    return missingPayload.map(
      (row) =>
        `Bank GL ${row.id} (${row.name ?? 'unnamed'}) missing payload fields; has GL=${row.buildium_gl_account_id}, BuildiumBank=${row.buildium_bank_account_id}`,
    )
  },

  async verify_property_links(client) {
    const { data, error } = await client
      .from('properties')
      .select('id, name, operating_bank_gl_account_id, deposit_trust_gl_account_id')

    if (error) return [`properties fetch failed: ${error.message}`]

    const glIds = new Set<string>()
    for (const row of data || []) {
      if ((row as any).operating_bank_gl_account_id) glIds.add(String((row as any).operating_bank_gl_account_id))
      if ((row as any).deposit_trust_gl_account_id) glIds.add(String((row as any).deposit_trust_gl_account_id))
    }

    if (!glIds.size) return []

    const { data: banks, error: glError } = await client
      .from('gl_accounts')
      .select('id, is_bank_account')
      .in('id', Array.from(glIds))

    if (glError) return [`gl_accounts lookup failed: ${glError.message}`]
    const bankMap = new Map((banks || []).map((b) => [String(b.id), Boolean((b as any).is_bank_account)]))

    const errors: string[] = []
    for (const row of data || []) {
      const op = (row as any).operating_bank_gl_account_id
      const dep = (row as any).deposit_trust_gl_account_id
      if (op && !bankMap.get(String(op))) {
        errors.push(`Property ${row.id} (${row.name}) operating_bank_gl_account_id=${op} is not a bank gl account`)
      }
      if (dep && !bankMap.get(String(dep))) {
        errors.push(`Property ${row.id} (${row.name}) deposit_trust_gl_account_id=${dep} is not a bank gl account`)
      }
    }

    return errors
  },

  async verify_buildium_payload_shape(client) {
    const { data, error } = await client
      .from('gl_accounts')
      .select(
        'id, name, buildium_gl_account_id, bank_account_number, bank_routing_number, bank_country, bank_account_type, bank_last_source, bank_last_source_ts',
      )
      .eq('is_bank_account', true)
      .limit(5000)

    if (error) return [`gl_accounts fetch failed: ${error.message}`]

    const failures = (data || []).filter(
      (row) =>
        !row.buildium_gl_account_id ||
        !row.bank_account_number ||
        !row.bank_routing_number ||
        !row.bank_country ||
        !row.bank_account_type,
    )

    return failures.map(
      (row) =>
        `Bank GL ${row.id} (${row.name ?? 'unnamed'}) missing Buildium payload fields (GLAccountId/bank details)`,
    )
  },
}

async function main() {
  const client = getClient()
  const requested = process.argv.slice(2).filter(Boolean)
  const toRun = requested.length ? requested : Object.keys(checks)

  const allErrors: string[] = []

  for (const name of toRun) {
    const fn = checks[name]
    if (!fn) {
      console.warn(`Skipping unknown check "${name}"`)
      continue
    }
    const errors = await fn(client)
    if (errors.length) {
      console.error(`❌ ${name} failed:`, errors.length, 'issues')
      errors.forEach((e) => console.error(`   - ${e}`))
      allErrors.push(...errors.map((e) => `${name}: ${e}`))
    } else {
      console.log(`✅ ${name} passed`)
    }
  }

  if (allErrors.length) {
    console.error(`\nVerification failed with ${allErrors.length} issues`)
    process.exitCode = 1
  } else {
    console.log('\nAll verification gates passed')
  }
}

main().catch((err) => {
  console.error('Verification aborted:', err)
  process.exit(1)
})
