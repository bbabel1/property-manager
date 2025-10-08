import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function testBalanceLogic() {
  try {
    console.log('🧪 Testing Balance Logic...\n')

    // Get the transaction line we found
    const { data: transactionLine, error: txError } = await supabase
      .from('transaction_lines')
      .select('id, amount, posting_type, date, memo, gl_account_id, gl_accounts(type, is_bank_account, name)')
      .limit(1)
      .single()

    if (txError) {
      console.error('❌ Error fetching transaction line:', txError)
      return
    }

    console.log('📋 Transaction Details:')
    console.log(`  - Amount: $${transactionLine.amount}`)
    console.log(`  - Posting Type: ${transactionLine.posting_type}`)
    console.log(`  - Account: ${transactionLine.gl_accounts?.name}`)
    console.log(`  - Account Type: ${transactionLine.gl_accounts?.type}`)
    console.log(`  - Is Bank Account: ${transactionLine.gl_accounts?.is_bank_account}`)
    console.log(`  - Memo: ${transactionLine.memo}`)

    console.log('\n🤔 Analysis:')
    console.log(`  - This is a ${transactionLine.posting_type} of $${transactionLine.amount} to ${transactionLine.gl_accounts?.name}`)
    
    if (transactionLine.posting_type === 'Debit' && transactionLine.gl_accounts?.name === 'Rent Income') {
      console.log('  - This represents rent that has been CHARGED to the tenant')
      console.log('  - The tenant now OWES this amount')
      console.log('  - So the balance should be POSITIVE (tenant owes money)')
    }

    // Test different balance calculation approaches
    console.log('\n🧮 Balance Calculation Tests:')
    
    const amount = Number(transactionLine.amount)
    const isDebit = transactionLine.posting_type === 'Debit'
    
    // Approach 1: Debits add to balance, Credits subtract
    const balance1 = isDebit ? amount : -amount
    console.log(`  Approach 1 (Debit=+, Credit=-): $${balance1.toFixed(2)}`)
    
    // Approach 2: Debits subtract from balance, Credits add  
    const balance2 = isDebit ? -amount : amount
    console.log(`  Approach 2 (Debit=-, Credit=+): $${balance2.toFixed(2)}`)
    
    // Approach 3: Always positive (absolute value)
    const balance3 = Math.abs(amount)
    console.log(`  Approach 3 (Always positive): $${balance3.toFixed(2)}`)

    console.log('\n💡 Expected Result:')
    console.log('  - Tenant owes $5.00 (from the rent charge)')
    console.log('  - Balance should be $5.00')
    console.log('  - Approach 1 seems correct for lease balances')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

testBalanceLogic()
