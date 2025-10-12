#!/usr/bin/env tsx

// Load environment early
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { upsertBillWithLines } from '../../src/lib/buildium-mappers'

async function main() {
  const billIdArg = process.argv[2]
  const billId = billIdArg ? Number(billIdArg) : 723093
  if (!billId || Number.isNaN(billId)) {
    console.error('Usage: tsx scripts/buildium/fetch-and-upsert-bill.ts <billId>')
    process.exit(1)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const buildiumBase = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1'
  const buildiumClientId = process.env.BUILDIUM_CLIENT_ID
  const buildiumClientSecret = process.env.BUILDIUM_CLIENT_SECRET
  if (!buildiumClientId || !buildiumClientSecret) {
    console.error('Missing Buildium env: BUILDIUM_CLIENT_ID/BUILDIUM_CLIENT_SECRET')
    process.exit(1)
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  // 1) Fetch bill from Buildium
  const url = `${buildiumBase}/bills/${billId}`
  console.log(`Fetching bill ${billId} from Buildium...`)
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-buildium-client-id': buildiumClientId,
      'x-buildium-client-secret': buildiumClientSecret,
    }
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    console.error(`Buildium API error: ${res.status} ${res.statusText}\n${txt}`)
    process.exit(1)
  }
  const buildiumBill = await res.json()
  console.log('Fetched bill payload with', Array.isArray(buildiumBill?.Lines) ? buildiumBill.Lines.length : 0, 'line(s)')

  // 2) Upsert into transactions/transaction_lines
  console.log('Upserting bill into transactions...')
  const { transactionId } = await upsertBillWithLines(buildiumBill, supabaseAdmin)
  console.log('Upsert complete. transaction_id =', transactionId)

  // 3) Show a brief summary
  const { data: txn } = await supabaseAdmin
    .from('transactions')
    .select('id, buildium_bill_id, date, total_amount, status, transaction_type')
    .eq('id', transactionId)
    .maybeSingle()
  if (txn) {
    console.log('Transaction header:', txn)
  }
  const { data: lines } = await supabaseAdmin
    .from('transaction_lines')
    .select('transaction_id, gl_account_id, amount, posting_type, memo')
    .eq('transaction_id', transactionId)
  console.log('Inserted lines:', lines?.length || 0)
}

main().catch((err) => {
  console.error('Failed to fetch/upsert bill:', err)
  process.exit(1)
})

