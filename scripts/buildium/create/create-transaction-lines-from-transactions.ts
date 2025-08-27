import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fetchGLAccountFromBuildium(glAccountId: number): Promise<any> {
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

async function getOrCreateGLAccount(glAccountId: number) {
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
    console.log(`  📋 Using existing GL account ID: ${glAccountId}`)
    return existingAccount.id
  }

  // GL account doesn't exist, fetch it from Buildium
  console.log(`  🔄 GL account ${glAccountId} not found in database, fetching from Buildium...`)
  
  try {
    const buildiumGLAccount = await fetchGLAccountFromBuildium(glAccountId)
    
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

async function createTransactionLinesFromTransactions() {
  console.log('🔄 Creating transaction lines from existing transactions...')

  try {
    // Get all transactions that don't have transaction lines yet
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select(`
        id,
        buildium_transaction_id,
        TransactionType,
        TotalAmount,
        Date,
        Memo
      `)
      .eq('buildium_lease_id', 16235)

    if (fetchError) {
      throw new Error(`Failed to fetch transactions: ${fetchError.message}`)
    }

    if (!transactions || transactions.length === 0) {
      console.log('No transactions found')
      return
    }

    console.log(`Found ${transactions.length} transactions to process`)

    for (const transaction of transactions) {
      console.log(`Processing transaction ${transaction.buildium_transaction_id}...`)

      // Check if transaction lines already exist for this transaction
      const { data: existingLines, error: checkError } = await supabase
        .from('transaction_lines')
        .select('id')
        .eq('transaction_id', transaction.id)

      if (checkError) {
        console.error(`Failed to check existing lines for transaction ${transaction.id}: ${checkError.message}`)
        continue
      }

      if (existingLines && existingLines.length > 0) {
        console.log(`  ⏭️  Transaction ${transaction.buildium_transaction_id} already has ${existingLines.length} transaction lines, skipping`)
        continue
      }

      // For this script, we'll create a placeholder transaction line
      // In a real scenario, you'd fetch the actual GL account data from Buildium
      console.log(`  ⚠️  Note: This script creates placeholder transaction lines. For real GL account data, use create-buildium-transaction-lines.ts`)

      // Create a simple transaction line for this transaction
      // This is a placeholder - in a real scenario, you'd fetch the actual lines from Buildium
      const transactionLineData = {
        transaction_id: transaction.id,
        gl_account_id: null, // Would need to be set based on actual GL account
        amount: Math.abs(transaction.TotalAmount),
        posting_type: transaction.TotalAmount >= 0 ? 'Credit' : 'Debit',
        memo: transaction.Memo || `Transaction ${transaction.TransactionType}`,
        account_entity_type: 'Rental' as const,
        date: transaction.Date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const { data: newLine, error: insertError } = await supabase
        .from('transaction_lines')
        .insert(transactionLineData)
        .select()
        .single()

      if (insertError) {
        console.error(`  ❌ Failed to create transaction line for transaction ${transaction.buildium_transaction_id}: ${insertError.message}`)
      } else {
        console.log(`  ✅ Created transaction line ${newLine.id} for transaction ${transaction.buildium_transaction_id}`)
      }
    }

    console.log('🎉 Successfully processed all transactions')
    console.log('💡 Tip: For complete GL account data, run create-buildium-transaction-lines.ts instead')

  } catch (error) {
    console.error('❌ Error creating transaction lines:', error)
    throw error
  }
}

// Run the script
createTransactionLinesFromTransactions()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
