import { createClient } from '@supabase/supabase-js'
import { resolveGLAccountId } from '../../src/lib/buildium-mappers'
import * as dotenv from 'dotenv'

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
  SubAccounts?: number[]
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

  // Delegate creation to shared resolver to avoid duplication.
  console.log(`  🔄 GL account ${glAccountId} not found locally, resolving via shared mapper...`)
  const resolvedId = await resolveGLAccountId(glAccountId, supabase)
  if (!resolvedId) {
    throw new Error(`Failed to resolve/create GL account ${glAccountId}`)
  }
  console.log(`  ✅ Resolved GL account ${glAccountName} → ${resolvedId}`)
  return resolvedId
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
