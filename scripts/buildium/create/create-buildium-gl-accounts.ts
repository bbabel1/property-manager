import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { logger } from './utils/logger'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const buildiumGLAccountIds = ['3', '5'] // Rent Income and Security Deposit Liability

interface BuildiumGLAccount {
  Id: number
  AccountNumber: string | null
  Name: string
  Description: string
  Type: string
  SubType: string
  IsDefaultGLAccount: boolean
  DefaultAccountName: string
  IsContraAccount: boolean
  IsBankAccount: boolean
  CashFlowClassification: string | null
  ExcludeFromCashBalances: boolean
  SubAccounts: any[]
  IsActive: boolean
  ParentGLAccountId: number | null
  IsCreditCardAccount: boolean
}

async function fetchGLAccountFromBuildium(glAccountId: string): Promise<BuildiumGLAccount> {
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

async function createGLAccountRecord(glAccount: BuildiumGLAccount) {
  const glAccountData = {
    buildium_gl_account_id: glAccount.Id,
    account_number: glAccount.AccountNumber,
    name: glAccount.Name,
    description: glAccount.Description,
    type: glAccount.Type,
    sub_type: glAccount.SubType,
    is_default_gl_account: glAccount.IsDefaultGLAccount,
    default_account_name: glAccount.DefaultAccountName,
    is_contra_account: glAccount.IsContraAccount,
    is_bank_account: glAccount.IsBankAccount,
    cash_flow_classification: glAccount.CashFlowClassification,
    exclude_from_cash_balances: glAccount.ExcludeFromCashBalances,
    is_active: glAccount.IsActive,
    parent_gl_account_id: glAccount.ParentGLAccountId,
    is_credit_card_account: glAccount.IsCreditCardAccount,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('gl_accounts')
    .upsert(glAccountData, {
      onConflict: 'buildium_gl_account_id'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create GL account record: ${error.message}`)
  }

  return data
}

async function main() {
  try {
    logger.info(`Fetching ${buildiumGLAccountIds.length} GL accounts from Buildium...`)
    const createdGLAccountIds: string[] = []
    
    for (const glAccountId of buildiumGLAccountIds) {
      logger.info(`Fetching GL account ${glAccountId} from Buildium...`)
      const buildiumGLAccount = await fetchGLAccountFromBuildium(glAccountId)
      
      logger.info(`Creating GL account record for ${buildiumGLAccount.Name}...`)
      const glAccount = await createGLAccountRecord(buildiumGLAccount)
      createdGLAccountIds.push(glAccount.id)
      
      console.log(`✅ Created GL account: ${glAccount.id}`)
      console.log(`   Buildium ID: ${buildiumGLAccount.Id}`)
      console.log(`   Name: ${buildiumGLAccount.Name}`)
      console.log(`   Type: ${buildiumGLAccount.Type}`)
      console.log(`   Sub Type: ${buildiumGLAccount.SubType}`)
      console.log(`   Description: ${buildiumGLAccount.Description}`)
    }
    
    logger.info('Successfully created all GL account records!')
    console.log('\n=== SUMMARY ===')
    console.log(`Created ${createdGLAccountIds.length} GL account records`)
    console.log('GL Account IDs:', createdGLAccountIds)
    console.log('All GL accounts have been successfully mapped to the database')
    
  } catch (error) {
    logger.error('Failed to create GL account records')
    console.error('Full error details:', error)
    process.exit(1)
  }
}

main()
