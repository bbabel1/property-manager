import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// GL accounts are resolved via shared resolver in buildium-mappers

async function createTransactionLinesFromTransactions() {
  console.log('🔄 Creating transaction lines from existing transactions...')

  try {
    // Get all transactions that don't have transaction lines yet
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select(`
        id,
        buildium_transaction_id,
        transaction_type,
        total_amount,
        date,
        memo
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
        amount: Math.abs(transaction.total_amount),
        posting_type: transaction.total_amount >= 0 ? 'Credit' : 'Debit',
        memo: transaction.memo || `Transaction ${transaction.transaction_type}`,
        account_entity_type: 'Rental' as const,
        date: transaction.date,
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
