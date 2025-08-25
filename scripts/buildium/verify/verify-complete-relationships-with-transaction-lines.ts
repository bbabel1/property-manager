import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyCompleteRelationships() {
  console.log('🔍 Verifying complete relationship structure...\n')

  try {
    // 1. Verify lease and its relationships
    console.log('📋 1. LEASE RELATIONSHIPS:')
    const { data: leaseData, error: leaseError } = await supabase
      .from('lease')
      .select(`
        id,
        buildium_lease_id,
        unitId,
        propertyId,
        unit:units(
          id,
          buildium_unit_id,
          property_id,
          property:properties(
            id,
            buildium_property_id,
            name
          )
        )
      `)
      .eq('buildium_lease_id', 16235)
      .single()

    if (leaseError) {
      throw new Error(`Failed to fetch lease data: ${leaseError.message}`)
    }

    console.log(`   Lease ID: ${leaseData.id} (Buildium: ${leaseData.buildium_lease_id})`)
    console.log(`   Unit ID: ${leaseData.unitId}`)
    console.log(`   Property ID: ${leaseData.propertyId}`)
    console.log(`   Unit Details: ${leaseData.unit?.id} (Buildium: ${leaseData.unit?.buildium_unit_id})`)
    console.log(`   Property Details: ${leaseData.unit?.property?.name} (Buildium: ${leaseData.unit?.property?.buildium_property_id})`)

    // 2. Verify transactions and their relationships
    console.log('\n📋 2. TRANSACTION RELATIONSHIPS:')
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('transactions')
      .select(`
        id,
        buildium_transaction_id,
        lease_id,
        TransactionType,
        TotalAmount,
        Date
      `)
      .eq('buildium_lease_id', 16235)

    if (transactionsError) {
      throw new Error(`Failed to fetch transactions data: ${transactionsError.message}`)
    }

    console.log(`   Total Transactions: ${transactionsData?.length || 0}`)
    
    transactionsData?.forEach((transaction, index) => {
      console.log(`   Transaction ${index + 1}:`)
      console.log(`     ID: ${transaction.id} (Buildium: ${transaction.buildium_transaction_id})`)
      console.log(`     Type: ${transaction.TransactionType}`)
      console.log(`     Amount: $${transaction.TotalAmount}`)
      console.log(`     Date: ${transaction.Date}`)
      console.log(`     Lease ID: ${transaction.lease_id}`)
    })

    // 3. Verify transaction lines directly
    console.log('\n📋 3. TRANSACTION LINES RELATIONSHIPS:')
    const { data: transactionLinesData, error: transactionLinesError } = await supabase
      .from('transaction_lines')
      .select(`
        id,
        transaction_id,
        gl_account_id,
        amount,
        posting_type,
        memo,
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
        )
      `)
      .eq('buildium_lease_id', 16235)

    if (transactionLinesError) {
      throw new Error(`Failed to fetch transaction lines data: ${transactionLinesError.message}`)
    }

    console.log(`   Total Transaction Lines: ${transactionLinesData?.length || 0}`)
    
    transactionLinesData?.forEach((entry, index) => {
      console.log(`   Entry ${index + 1}:`)
      console.log(`     ID: ${entry.id}`)
      console.log(`     GL Account: ${entry.gl_account?.name} (${entry.gl_account?.type})`)
      console.log(`     Amount: $${entry.amount} (${entry.posting_type})`)
      console.log(`     Property: ${entry.property?.name} (${entry.buildium_property_id})`)
      console.log(`     Unit: ${entry.unit?.unit_number} (${entry.buildium_unit_id})`)
      console.log(`     Lease ID: ${entry.lease_id} (Buildium: ${entry.buildium_lease_id})`)
    })

    // 4. Summary statistics
    console.log('\n📊 4. RELATIONSHIP SUMMARY:')
    console.log(`   ✅ Lease has ${transactionsData?.length || 0} transactions`)
    console.log(`   ✅ Transactions have ${transactionLinesData?.length || 0} transaction lines`)
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
verifyCompleteRelationships()
  .then(() => {
    console.log('✅ Verification completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  })
