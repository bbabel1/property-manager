#!/usr/bin/env tsx

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Load environment variables
config({ path: '.env.local' })

type BankAccountType = 'checking' | 'savings' | 'money_market' | 'certificate_of_deposit'
type Country = Database['public']['Enums']['countries']

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface BuildiumBankAccount {
  Id: number
  Name: string
  Description?: string
  BankAccountType: string
  Country: string
  AccountNumber: string
  RoutingNumber?: string
  IsActive: boolean
  Balance?: number
  GLAccountId?: number
}

async function fetchBuildiumBankAccount(): Promise<BuildiumBankAccount> {
  console.log('🔍 Fetching bank accounts from Buildium...')
  
  const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/bankaccounts?pageSize=1&pageNumber=1`, {
    method: 'GET',
    headers: {
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Buildium API error: ${response.status} ${response.statusText}`)
  }

  const bankAccounts = await response.json()
  console.log(`✅ Found ${Array.isArray(bankAccounts) ? bankAccounts.length : 1} bank account(s)`)
  
  if (Array.isArray(bankAccounts) && bankAccounts.length > 0) {
    return bankAccounts[0]
  } else if (bankAccounts && bankAccounts.Id) {
    return bankAccounts
  } else {
    throw new Error('No bank accounts found in Buildium response')
  }
}

function normalizeBankAccountType(input: string): BankAccountType {
  const normalized = String(input).trim().toLowerCase()
  
  // Map Buildium values to database enum values
  if (normalized === 'checking') return 'checking'
  if (normalized === 'savings') return 'savings'
  if (normalized === 'moneymarket' || normalized === 'money_market') return 'money_market'
  if (normalized === 'certificateofdeposit' || normalized === 'certificate_of_deposit') return 'certificate_of_deposit'
  
  // Default fallback
  return 'checking'
}

async function findOrCreateGLAccount(): Promise<string> {
  console.log('🔍 Looking for existing GL account for bank accounts...')
  
  // First, try to find an existing GL account marked as bank account
  const { data: existingGLAccount, error: glError } = await supabase
    .from('gl_accounts')
    .select('id')
    .eq('is_bank_account', true)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!glError && existingGLAccount) {
    console.log('✅ Found existing GL account for bank accounts:', existingGLAccount.id)
    return existingGLAccount.id
  }

  console.log('🔍 Creating default GL account for bank accounts...')
  
  // Try to find the existing GL account with buildium_gl_account_id: 0
  const { data: existingDefaultGL, error: findError } = await supabase
    .from('gl_accounts')
    .select('id')
    .eq('buildium_gl_account_id', 0)
    .limit(1)
    .single()

  if (!findError && existingDefaultGL) {
    console.log('✅ Found existing default GL account:', existingDefaultGL.id)
    return existingDefaultGL.id
  }

  // Create a new GL account with a unique buildium_gl_account_id
  const { data: newGLAccount, error: createGLError } = await supabase
    .from('gl_accounts')
    .insert({
      buildium_gl_account_id: -1, // Use -1 for local default accounts
      name: 'Default Bank Account GL',
      type: 'Asset',
      is_bank_account: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('id')
    .single()

  if (createGLError || !newGLAccount) {
    throw new Error(`Failed to create GL account: ${createGLError?.message}`)
  }

  console.log('✅ Created default GL account:', newGLAccount.id)
  return newGLAccount.id
}

async function syncBankAccountToDatabase(buildiumAccount: BuildiumBankAccount, glAccountId: string) {
  console.log('🔍 Syncing bank account to database...')
  
  const now = new Date().toISOString()
  
  const bankAccountData = {
    buildium_bank_id: buildiumAccount.Id,
    name: buildiumAccount.Name,
    description: buildiumAccount.Description || null,
    bank_account_type: normalizeBankAccountType(buildiumAccount.BankAccountType),
    account_number: buildiumAccount.AccountNumber,
    routing_number: buildiumAccount.RoutingNumber || null,
    is_active: buildiumAccount.IsActive,
    balance: buildiumAccount.Balance || 0,
    buildium_balance: buildiumAccount.Balance || 0,
    gl_account: glAccountId,
    country: (buildiumAccount.Country || 'United States') as Country,
    created_at: now,
    updated_at: now,
    last_source: 'buildium' as const,
    last_source_ts: now
  }

  console.log('📝 Bank account data to insert:', {
    ...bankAccountData,
    account_number: '***' + bankAccountData.account_number.slice(-4) // Mask for security
  })

  const { data, error } = await supabase
    .from('bank_accounts')
    .insert(bankAccountData)
    .select('id, name, bank_account_type, account_number, routing_number, is_active')
    .single()

  if (error) {
    throw new Error(`Failed to insert bank account: ${error.message}`)
  }

  if (!data.account_number) {
    throw new Error('Insert did not return an account number')
  }

  console.log('✅ Bank account synced successfully:', {
    id: data.id,
    name: data.name,
    type: data.bank_account_type,
    account_number: '***' + data.account_number.slice(-4)
  })

  return data
}

async function main() {
  try {
    console.log('🚀 Starting Buildium bank account sync...')
    
    // 1. Fetch bank account from Buildium
    const buildiumAccount = await fetchBuildiumBankAccount()
    console.log('📋 Buildium bank account:', {
      id: buildiumAccount.Id,
      name: buildiumAccount.Name,
      type: buildiumAccount.BankAccountType,
      account_number: '***' + buildiumAccount.AccountNumber.slice(-4)
    })
    
    // 2. Find or create GL account
    const glAccountId = await findOrCreateGLAccount()
    
    // 3. Sync to database
    const syncedAccount = await syncBankAccountToDatabase(buildiumAccount, glAccountId)
    
    console.log('🎉 Successfully synced bank account from Buildium!')
    console.log('📊 Final result:', syncedAccount)
    
  } catch (error) {
    console.error('❌ Error syncing bank account:', error)
    process.exit(1)
  }
}

// Run the script
main()
