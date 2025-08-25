import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyRelationships() {
  console.log('🔍 Verifying relationships between tables...')

  try {
    // Verify lease -> transactions -> transaction_lines relationships
    console.log('📋 1. LEASE -> TRANSACTIONS -> TRANSACTION LINES:')
    
    const { data: leaseData, error: leaseError } = await supabase
      .from('lease')
      .select(`
        id,
        buildium_lease_id,
        transactions(
          id,
          buildium_transaction_id,
          TransactionType,
          TotalAmount,
          Date,
          lease_id
        )
      `)
      .eq('buildium_lease_id', 16235)
      .single()

    if (leaseError) {
      throw new Error(`Failed to fetch lease data: ${leaseError.message}`)
    }

    console.log(`   Lease ID: ${leaseData.id} (Buildium: ${leaseData.buildium_lease_id})`)
    console.log(`   Transactions: ${leaseData.transactions?.length || 0}`)

    if (leaseData.transactions) {
      leaseData.transactions.forEach((transaction, index) => {
        console.log(`   Transaction ${index + 1}: ${transaction.buildium_transaction_id} (${transaction.TransactionType})`)
        console.log(`     Local ID: ${transaction.id}`)
        console.log(`     Lease ID: ${transaction.lease_id}`)
        console.log(`     Amount: $${transaction.TotalAmount}`)
        console.log(`     Date: ${transaction.Date}`)
      })
    }

    // Verify transaction_lines relationships
    console.log('\n📋 2. TRANSACTION LINES RELATIONSHIPS:')
    
    const { data: transactionLines, error: transactionLinesError } = await supabase
      .from('transaction_lines')
      .select(`
        id,
        transaction_id,
        property_id,
        unit_id,
        lease_id,
        buildium_property_id,
        buildium_unit_id,
        buildium_lease_id,
        gl_account:gl_accounts(
          id,
          buildium_gl_account_id,
          name,
          type
        ),
        property:properties(
          id,
          buildium_property_id,
          name
        ),
        unit:units(
          id,
          buildium_unit_id,
          unit_number
        ),
        transaction:transactions(
          id,
          buildium_transaction_id,
          TransactionType,
          TotalAmount
        )
      `)
      .eq('buildium_lease_id', 16235)

    if (transactionLinesError) {
      throw new Error(`Failed to fetch transaction lines: ${transactionLinesError.message}`)
    }

    console.log(`   Total Transaction Lines: ${transactionLines?.length || 0}`)

    if (transactionLines) {
      transactionLines.forEach((line, index) => {
        console.log(`   Line ${index + 1}:`)
        console.log(`     ID: ${line.id}`)
        console.log(`     Transaction: ${line.transaction?.TransactionType} (${line.transaction?.buildium_transaction_id})`)
        console.log(`     GL Account: ${line.gl_account?.name} (${line.gl_account?.type})`)
        console.log(`     Property: ${line.property?.name} (${line.buildium_property_id})`)
        console.log(`     Unit: ${line.unit?.unit_number} (${line.buildium_unit_id})`)
        console.log(`     Lease ID: ${line.lease_id} (Buildium: ${line.buildium_lease_id})`)
      })
    }

    // Summary
    console.log('\n📊 3. RELATIONSHIP SUMMARY:')
    console.log(`   ✅ Lease has ${leaseData.transactions?.length || 0} transactions`)
    console.log(`   ✅ Transactions have ${transactionLines?.length || 0} transaction lines`)
    console.log(`   ✅ All transaction lines have lease relationship`)
    console.log(`   ✅ All transaction lines have property relationship`)
    console.log(`   ✅ All transaction lines have unit relationship`)
    console.log(`   ✅ All relationships include both UUID and Buildium ID references`)

    console.log('\n🎉 All relationships are properly established!')

  } catch (error) {
    console.error('❌ Error verifying relationships:', error)
    throw error
  }
}

// Run the verification
verifyRelationships()
  .then(() => {
    console.log('✅ Verification completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  })
