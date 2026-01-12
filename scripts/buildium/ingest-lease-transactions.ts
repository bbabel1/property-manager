#!/usr/bin/env tsx

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { upsertLeaseTransactionWithLines } from '@/lib/buildium-mappers'
import { ensureBuildiumEnabledForScript } from './ensure-enabled'

// Prefer local overrides but fall back to .env when running outside Next.js
config({ path: '.env.local' })
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const buildiumBaseUrl = process.env.BUILDIUM_BASE_URL!
const buildiumClientId = process.env.BUILDIUM_CLIENT_ID!
const buildiumClientSecret = process.env.BUILDIUM_CLIENT_SECRET!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

function getArgLeaseId(): number {
  const arg = process.argv[2] || process.env.LEASE_ID
  if (!arg) {
    console.error('Usage: tsx scripts/buildium/ingest-lease-transactions.ts <LEASE_ID>')
    process.exit(1)
  }
  const n = Number(arg)
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`Invalid LEASE_ID: ${arg}`)
    process.exit(1)
  }
  return n
}

async function fetchLeaseTransactions(leaseId: number, limit = 100): Promise<any[]> {
  const all: any[] = []
  let offset = 0
  for (;;) {
    const url = new URL(`${buildiumBaseUrl}/rentals/leases/${leaseId}/transactions`)
    url.searchParams.set('limit', String(limit))
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': buildiumClientId,
        'x-buildium-client-secret': buildiumClientSecret,
      'x-buildium-egress-allowed': '1',
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Buildium API error ${res.status} ${res.statusText}: ${body}`)
    }
    const page: any[] = await res.json()
    all.push(...page)
    if (page.length < limit) break
    offset += limit
  }
  return all
}

async function main() {
  const leaseId = getArgLeaseId()
  await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
  console.log(`🔄 Ingesting Buildium lease transactions for LeaseId=${leaseId} ...`)

  const transactions = await fetchLeaseTransactions(leaseId)
  console.log(`Found ${transactions.length} transactions to process`)

  let success = 0
  let failed = 0

  for (const tx of transactions) {
    try {
      const { transactionId } = await upsertLeaseTransactionWithLines(tx, supabase)
      console.log(`  ✅ Upserted transaction ${tx.Id} → ${transactionId}`)
      success++
    } catch (err) {
      console.error(`  ❌ Failed to upsert transaction ${tx?.Id}:`, err)
      failed++
    }
  }

  console.log(`\n🎉 Done. Success: ${success}, Failed: ${failed}`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
