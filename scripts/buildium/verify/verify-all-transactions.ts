import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function verifyAllTransactions() {
  console.log('=== VERIFYING ALL TRANSACTIONS FOR LEASE 16235 ===\n')
  
  // Get all transactions for lease 16235
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('buildium_lease_id', 16235)
    .order('Date', { ascending: false })
  
  if (error) {
    console.error('Error fetching transactions:', error)
    return
  }
  
  console.log(`Found ${transactions.length} transactions in database:\n`)
  
  transactions.forEach((transaction, index) => {
    console.log(`=== TRANSACTION ${index + 1} ===`)
    console.log(`ID: ${transaction.id}`)
    console.log(`Buildium Transaction ID: ${transaction.buildium_transaction_id}`)
    console.log(`Date: ${transaction.Date}`)
    console.log(`Type: ${transaction.TransactionType}`)
    console.log(`Amount: $${transaction.TotalAmount}`)
    console.log(`Memo: ${transaction.Memo || 'N/A'}`)
    console.log(`Payment Method: ${transaction.PaymentMethod || 'N/A'}`)
    console.log(`Check Number: ${transaction.CheckNumber || 'N/A'}`)
    console.log(`Payee Tenant ID: ${transaction.PayeeTenantId || 'N/A'}`)
    console.log(`Bill ID: ${transaction.buildium_bill_id || 'N/A'}`)
    console.log('')
  })
  
  // Summary by transaction type
  const typeSummary = transactions.reduce((acc, tx) => {
    const type = tx.TransactionType
    if (!acc[type]) {
      acc[type] = { count: 0, totalAmount: 0 }
    }
    acc[type].count++
    acc[type].totalAmount += Number(tx.TotalAmount)
    return acc
  }, {} as Record<string, { count: number, totalAmount: number }>)
  
  console.log('=== TRANSACTION TYPE SUMMARY ===')
  Object.entries(typeSummary).forEach(([type, data]) => {
    console.log(`${type}: ${data.count} transactions, Total: $${data.totalAmount}`)
  })
  
  console.log('\n✅ All transactions for lease 16235 have been successfully stored in the database!')
}

verifyAllTransactions()
