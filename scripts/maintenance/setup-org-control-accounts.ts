#!/usr/bin/env -S node --loader tsx
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase URL or service role key')
  return createClient(url, key)
}

async function findBestGlAccount(
  supabase: any,
  orgId: string,
  type: 'asset' | 'income',
  preferences: string[]
): Promise<string | null> {
  // Query all accounts of the org, then filter by type (case-insensitive)
  const { data: allAccounts, error } = await supabase
    .from('gl_accounts')
    .select('id, name, type, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true)

  if (error) throw error
  if (!allAccounts || allAccounts.length === 0) return null

  // Filter by type (case-insensitive)
  const accounts = allAccounts.filter((a: any) => (a.type || '').toLowerCase() === type.toLowerCase())
  if (accounts.length === 0) return null

  // Try exact matches first (case-insensitive)
  for (const pref of preferences) {
    const exact = accounts.find((a: any) => a.name?.toLowerCase() === pref.toLowerCase())
    if (exact) return exact.id
  }

  // Try partial matches
  for (const pref of preferences) {
    const partial = accounts.find((a: any) => a.name?.toLowerCase().includes(pref.toLowerCase()))
    if (partial) return partial.id
  }

  // Return first active account of the right type
  return accounts[0]?.id || null
}

async function setupControlAccounts(supabase: any, orgId: string) {
  console.log(`🔧 Setting up control accounts for org ${orgId}...\n`)

  // Check if org exists
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', orgId)
    .maybeSingle()

  if (orgError) throw orgError
  if (!org) {
    throw new Error(`Organization ${orgId} not found`)
  }

  console.log(`Organization: ${org.name} (${org.id})\n`)

  // Check if control accounts already exist
  const { data: existing, error: checkError } = await supabase
    .from('org_control_accounts')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()

  if (checkError) throw checkError
  if (existing) {
    console.log('⚠️  Control accounts already exist for this org:')
    console.log(`   AR Account: ${existing.ar_account_id}`)
    console.log(`   Rent Income: ${existing.rent_income_account_id}`)
    console.log(`   Late Fee Income: ${existing.late_fee_income_account_id || 'None'}`)
    console.log(`   Undeposited Funds: ${existing.undeposited_funds_account_id || 'None'}`)
    console.log('\n💡 Use --force flag to overwrite, or update manually via SQL/API')
    return false
  }

  // Find required accounts
  console.log('🔍 Finding suitable GL accounts...\n')

  const arAccountId = await findBestGlAccount(supabase, orgId, 'asset', [
    'Accounts Receivable',
    'AR',
    'Receivable'
  ])

  const rentIncomeId = await findBestGlAccount(supabase, orgId, 'income', [
    'Rent Income',
    'Rent'
  ])

  const lateFeeIncomeId = await findBestGlAccount(supabase, orgId, 'income', [
    'Late Fee Income',
    'Late Fee',
    'Late'
  ])

  const undepositedFundsId = await findBestGlAccount(supabase, orgId, 'asset', [
    'Undeposited Funds',
    'Undeposited',
    'Cash - Undeposited'
  ])

  // Validate required accounts
  if (!arAccountId) {
    throw new Error('No suitable AR account (asset type) found. Please create one first.')
  }

  if (!rentIncomeId) {
    throw new Error('No suitable rent income account (income type) found. Please create one first.')
  }

  console.log('✓ Found accounts:')
  console.log(`  AR Account: ${arAccountId}`)
  console.log(`  Rent Income: ${rentIncomeId}`)
  if (lateFeeIncomeId) console.log(`  Late Fee Income: ${lateFeeIncomeId}`)
  if (undepositedFundsId) console.log(`  Undeposited Funds: ${undepositedFundsId}`)
  console.log()

  // Validate account types (safety check)
  const { data: arAccount, error: arError } = await supabase
    .from('gl_accounts')
    .select('id, name, type')
    .eq('id', arAccountId)
    .single()

  if (arError) throw arError
  if ((arAccount?.type || '').toLowerCase() !== 'asset') {
    throw new Error(`AR account ${arAccountId} is not an asset type account`)
  }

  const { data: rentAccount, error: rentError } = await supabase
    .from('gl_accounts')
    .select('id, name, type')
    .eq('id', rentIncomeId)
    .single()

  if (rentError) throw rentError
  if ((rentAccount?.type || '').toLowerCase() !== 'income') {
    throw new Error(`Rent income account ${rentIncomeId} is not an income type account`)
  }

  // Insert control accounts
  const payload = {
    org_id: orgId,
    ar_account_id: arAccountId,
    rent_income_account_id: rentIncomeId,
    late_fee_income_account_id: lateFeeIncomeId || null,
    undeposited_funds_account_id: undepositedFundsId || null,
  }

  const { data: inserted, error: insertError } = await supabase
    .from('org_control_accounts')
    .insert(payload)
    .select()
    .single()

  if (insertError) throw insertError

  console.log('✅ Successfully created control accounts:')
  console.log(`   AR Account: ${arAccount?.name} (${arAccountId})`)
  console.log(`   Rent Income: ${rentAccount?.name} (${rentIncomeId})`)
  if (lateFeeIncomeId) {
    console.log(`   Late Fee Income: (${lateFeeIncomeId})`)
  }
  if (undepositedFundsId) {
    console.log(`   Undeposited Funds: (${undepositedFundsId})`)
  }

  return true
}

async function main() {
  const supabase = getAdmin()
  const orgId = process.argv[2]
  
  if (!orgId) {
    console.error('Usage: npx tsx scripts/maintenance/setup-org-control-accounts.ts <org-id>')
    process.exit(1)
  }

  try {
    await setupControlAccounts(supabase, orgId)
  } catch (e: any) {
    console.error('❌ Error:', e.message || e)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
