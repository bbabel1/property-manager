#!/usr/bin/env tsx

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { upsertLeaseTransactionWithLines } from '@/lib/buildium-mappers'

config({ path: '.env.local' })
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const buildiumBaseUrl = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1'
const buildiumClientId = process.env.BUILDIUM_CLIENT_ID!
const buildiumClientSecret = process.env.BUILDIUM_CLIENT_SECRET!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const PAGE_SIZE = 200

async function fetchTransaction(leaseId: number, txId: number): Promise<any> {
  const url = `${buildiumBaseUrl}/leases/${leaseId}/transactions/${txId}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'x-buildium-client-id': buildiumClientId,
      'x-buildium-client-secret': buildiumClientSecret,
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Buildium API error ${res.status} ${res.statusText}: ${body}`)
  }
  return res.json()
}

async function main() {
  console.log('🔄 Backfilling Buildium transactions to populate new fields and payment splits')
  let offset = 0
  let processed = 0
  let skipped = 0
  let failed = 0

  for (;;) {
    const { data, error } = await supabase
      .from('transactions')
      .select('buildium_transaction_id, buildium_lease_id')
      .not('buildium_transaction_id', 'is', null)
      .order('buildium_transaction_id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    for (const row of data) {
      const txId = row.buildium_transaction_id
      const leaseId = row.buildium_lease_id
      if (!txId || !leaseId) {
        skipped++
        continue
      }
      try {
        const fullTx = await fetchTransaction(leaseId, txId)
        const { transactionId } = await upsertLeaseTransactionWithLines(fullTx, supabase)
        console.log(`  ✅ Upserted tx ${txId} (lease ${leaseId}) → ${transactionId}`)
        processed++
      } catch (err) {
        console.error(`  ❌ Failed tx ${txId} (lease ${leaseId}):`, err)
        failed++
      }
    }

    offset += PAGE_SIZE
  }

  console.log(
    `🎉 Backfill complete. Processed=${processed}, Skipped=${skipped}, Failed=${failed} (check logs for details)`,
  )
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
