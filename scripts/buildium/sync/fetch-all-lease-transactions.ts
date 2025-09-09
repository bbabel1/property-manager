import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const leaseId = '16235'

async function fetchAllTransactionsFromBuildium(leaseId: string) {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/${leaseId}/transactions`

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

async function createTransactionRecord(transaction: any) {
  const transactionData = {
    buildium_transaction_id: transaction.Id,
    date: transaction.Date,
    transaction_type: transaction.TransactionType,
    total_amount: transaction.TotalAmount,
    check_number: transaction.CheckNumber,
    buildium_lease_id: parseInt(leaseId),
    payee_tenant_id: transaction.PayeeTenantId,
    payment_method: transaction.PaymentMethod,
    memo: transaction.Memo,
    buildium_bill_id: transaction.BillId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('transactions')
    .upsert(transactionData, {
      onConflict: 'buildium_transaction_id'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create transaction record: ${error.message}`)
  }
  return data
}

async function main() {
  try {
    console.log(`Fetching all transactions for lease ${leaseId} from Buildium...`)
    const transactions = await fetchAllTransactionsFromBuildium(leaseId)
    
    console.log(`\n=== FOUND ${transactions.length} TRANSACTIONS ===`)
    
    // Display transaction summary
    transactions.forEach((transaction: any, index: number) => {
      console.log(`\nTransaction ${index + 1}:`)
      console.log(`  ID: ${transaction.Id}`)
      console.log(`  Date: ${transaction.Date}`)
      console.log(`  Type: ${transaction.TransactionType}`)
      console.log(`  Amount: $${transaction.TotalAmount}`)
      console.log(`  Memo: ${transaction.Memo}`)
      console.log(`  Payment Method: ${transaction.PaymentMethod || 'N/A'}`)
      console.log(`  Check Number: ${transaction.CheckNumber || 'N/A'}`)
    })
    
    console.log('\n=== CREATING TRANSACTION RECORDS ===')
    const createdTransactionIds: string[] = []
    
    for (const transaction of transactions) {
      try {
        console.log(`Creating transaction record for Buildium transaction ${transaction.Id}...`)
        const createdTransaction = await createTransactionRecord(transaction)
        createdTransactionIds.push(createdTransaction.id)
        
        console.log(`✅ Created transaction: ${createdTransaction.id}`)
        console.log(`   Buildium ID: ${transaction.Id}`)
        console.log(`   Type: ${transaction.TransactionType}`)
        console.log(`   Amount: $${transaction.TotalAmount}`)
        console.log(`   Date: ${transaction.Date}`)
      } catch (error) {
        console.error(`❌ Failed to create transaction ${transaction.Id}:`, error)
      }
    }
    
    console.log('\n=== SUMMARY ===')
    console.log(`Successfully created ${createdTransactionIds.length} transaction records`)
    console.log('Transaction IDs:', createdTransactionIds)
    
    // Verify the transactions were created
    console.log('\n=== VERIFICATION ===')
    const { data: dbTransactions, error: verifyError } = await supabase
      .from('transactions')
      .select('*')
      .eq('buildium_lease_id', parseInt(leaseId))
      .order('date', { ascending: false })
    
    if (verifyError) {
      console.error('Error verifying transactions:', verifyError)
    } else {
      console.log(`Found ${dbTransactions.length} transactions in database for lease ${leaseId}:`)
      dbTransactions.forEach((tx, index) => {
        console.log(`  ${index + 1}. ${tx.transaction_type} - $${tx.total_amount} (${tx.date})`)
      })
    }
    
  } catch (error) {
    console.error('Failed to fetch and create transactions:', error)
    process.exit(1)
  }
}

main()
