import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyBuildiumTransactionLines() {
  console.log('🔍 Verifying Buildium transaction lines...')

  try {
    const { data: transactionLines, error } = await supabase
      .from('transaction_lines')
      .select(`
        id,
        transaction_id,
        gl_account_id,
        amount,
        posting_type,
        memo,
        gl_account:gl_accounts(
          id,
          buildium_gl_account_id,
          name,
          type
        ),
        transaction:transactions(
          id,
          buildium_transaction_id,
          TransactionType,
          TotalAmount,
          Date
        )
      `)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch transaction lines: ${error.message}`)
    }

    console.log(`Found ${transactionLines?.length || 0} transaction lines`)

    if (transactionLines && transactionLines.length > 0) {
      console.log('\n📋 Transaction Lines Details:')
      
      transactionLines.forEach((entry, index) => {
        console.log(`\n${index + 1}. Transaction Line ID: ${entry.id}`)
        console.log(`   Transaction: ${entry.transaction?.TransactionType} (${entry.transaction?.buildium_transaction_id})`)
        console.log(`   GL Account: ${entry.gl_account?.name} (${entry.gl_account?.type})`)
        console.log(`   Amount: $${entry.amount} (${entry.posting_type})`)
        console.log(`   Memo: ${entry.memo || 'N/A'}`)
        console.log(`   Date: ${entry.transaction?.Date}`)
      })

      // Group by transaction to show totals
      const transactionGroups = transactionLines.reduce((groups, entry) => {
        const transactionId = entry.transaction_id
        if (!groups[transactionId]) {
          groups[transactionId] = []
        }
        groups[transactionId].push(entry)
        return groups
      }, {} as Record<string, typeof transactionLines>)

      console.log('\n📊 Transaction Summary:')
      Object.entries(transactionGroups).forEach(([transactionId, entries]) => {
        const transaction = entries[0]?.transaction
        const totalCredits = entries
          .filter(e => e.posting_type === 'Credit')
          .reduce((sum, e) => sum + Number(e.amount), 0)
        const totalDebits = entries
          .filter(e => e.posting_type === 'Debit')
          .reduce((sum, e) => sum + Number(e.amount), 0)

        console.log(`\nTransaction ${transaction?.buildium_transaction_id} (${transaction?.TransactionType}):`)
        console.log(`   Total Credits: $${totalCredits}`)
        console.log(`   Total Debits: $${totalDebits}`)
        console.log(`   Balance: $${totalCredits - totalDebits}`)
        console.log(`   Lines: ${entries.length}`)
      })
    }

  } catch (error) {
    console.error('❌ Error verifying transaction lines:', error)
    throw error
  }
}

// Run the verification
verifyBuildiumTransactionLines()
  .then(() => {
    console.log('✅ Verification completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  })
