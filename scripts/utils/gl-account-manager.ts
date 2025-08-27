import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export interface BuildiumGLAccount {
  Id: number
  AccountNumber: string | null
  Name: string
  Description: string | null
  Type: string
  SubType: string | null
  IsDefaultGLAccount: boolean
  DefaultAccountName: string | null
  IsContraAccount: boolean
  IsBankAccount: boolean
  CashFlowClassification: string | null
  ExcludeFromCashBalances: boolean
  IsActive: boolean
  ParentGLAccountId: number | null
  IsCreditCardAccount: boolean
}

export async function fetchGLAccountFromBuildium(glAccountId: number): Promise<BuildiumGLAccount> {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/glaccounts/${glAccountId}`

  const response = await fetch(buildiumUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
  }

  return response.json()
}

export async function getOrCreateGLAccount(glAccount: BuildiumGLAccount | number): Promise<string> {
  const glAccountId = typeof glAccount === 'number' ? glAccount : glAccount.Id
  const glAccountName = typeof glAccount === 'number' ? `ID ${glAccount}` : glAccount.Name

  // First, try to find the GL account in our database
  const { data: existingAccount, error: fetchError } = await supabase
    .from('gl_accounts')
    .select('id')
    .eq('buildium_gl_account_id', glAccountId)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
    throw new Error(`Failed to check for existing GL account: ${fetchError.message}`)
  }

  if (existingAccount) {
    console.log(`  📋 Using existing GL account: ${glAccountName} (ID: ${glAccountId})`)
    return existingAccount.id
  }

  // GL account doesn't exist, fetch it from Buildium
  console.log(`  🔄 GL account ${glAccountId} not found in database, fetching from Buildium...`)
  
  try {
    let buildiumGLAccount: BuildiumGLAccount

    if (typeof glAccount === 'number') {
      // We only have the ID, fetch the full details from Buildium
      buildiumGLAccount = await fetchGLAccountFromBuildium(glAccount)
    } else {
      // We already have the full GL account data
      buildiumGLAccount = glAccount
    }
    
    const glAccountData = {
      buildium_gl_account_id: buildiumGLAccount.Id,
      account_number: buildiumGLAccount.AccountNumber,
      name: buildiumGLAccount.Name,
      description: buildiumGLAccount.Description,
      type: buildiumGLAccount.Type,
      sub_type: buildiumGLAccount.SubType,
      is_default_gl_account: buildiumGLAccount.IsDefaultGLAccount,
      default_account_name: buildiumGLAccount.DefaultAccountName,
      is_contra_account: buildiumGLAccount.IsContraAccount,
      is_bank_account: buildiumGLAccount.IsBankAccount,
      cash_flow_classification: buildiumGLAccount.CashFlowClassification,
      exclude_from_cash_balances: buildiumGLAccount.ExcludeFromCashBalances,
      is_active: buildiumGLAccount.IsActive,
      buildium_parent_gl_account_id: buildiumGLAccount.ParentGLAccountId,
      is_credit_card_account: buildiumGLAccount.IsCreditCardAccount,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: newAccount, error: insertError } = await supabase
      .from('gl_accounts')
      .insert(glAccountData)
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to create GL account record: ${insertError.message}`)
    }

    console.log(`  ✅ Created new GL account: ${buildiumGLAccount.Name} (ID: ${buildiumGLAccount.Id})`)
    return newAccount.id

  } catch (error) {
    console.error(`  ❌ Failed to fetch/create GL account ${glAccountId}:`, error)
    throw error
  }
}

export async function ensureGLAccountExists(glAccountId: number): Promise<string> {
  return getOrCreateGLAccount(glAccountId)
}

export async function getGLAccountByBuildiumId(buildiumId: number): Promise<string | null> {
  const { data: account, error } = await supabase
    .from('gl_accounts')
    .select('id')
    .eq('buildium_gl_account_id', buildiumId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') { // Not found
      return null
    }
    throw new Error(`Failed to get GL account: ${error.message}`)
  }

  return account.id
}
