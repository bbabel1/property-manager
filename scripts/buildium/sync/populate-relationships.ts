import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function populateRelationships() {
  console.log('🔄 Populating relationships between tables...')

  try {
    // 1. Populate lease_id in transactions table
    console.log('📝 Step 1: Populating lease_id in transactions table...')
    
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('id, buildium_lease_id')
      .is('lease_id', null)

    if (transactionsError) {
      throw new Error(`Failed to fetch transactions: ${transactionsError.message}`)
    }

    if (transactions && transactions.length > 0) {
      console.log(`Found ${transactions.length} transactions to update`)

      for (const transaction of transactions) {
        // Get the local lease ID based on buildium_lease_id
        const { data: lease, error: leaseError } = await supabase
          .from('lease')
          .select('id')
          .eq('buildium_lease_id', transaction.buildium_lease_id)
          .single()

        if (leaseError) {
          console.error(`Failed to find lease for transaction ${transaction.id}: ${leaseError.message}`)
          continue
        }

        // Update the transaction with lease_id
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ lease_id: lease.id })
          .eq('id', transaction.id)

        if (updateError) {
          console.error(`Failed to update transaction ${transaction.id}: ${updateError.message}`)
        } else {
          console.log(`✅ Updated transaction ${transaction.id} with lease_id: ${lease.id}`)
        }
      }
    } else {
      console.log('No transactions found that need lease_id population')
    }

    // 2. Populate property_id and unit_id in transaction_lines table
    console.log('\n📝 Step 2: Populating property_id and unit_id in transaction_lines table...')
    
    const { data: transactionLines, error: transactionLinesError } = await supabase
      .from('transaction_lines')
      .select('id, transaction_id')
      .is('property_id', null)

    if (transactionLinesError) {
      throw new Error(`Failed to fetch transaction lines: ${transactionLinesError.message}`)
    }

    if (transactionLines && transactionLines.length > 0) {
      console.log(`Found ${transactionLines.length} transaction lines to update`)

      for (const line of transactionLines) {
        // Get the transaction to find the lease
        const { data: transaction, error: transactionError } = await supabase
          .from('transactions')
          .select('lease_id, buildium_lease_id')
          .eq('id', line.transaction_id)
          .single()

        if (transactionError) {
          console.error(`Failed to find transaction for line ${line.id}: ${transactionError.message}`)
          continue
        }

        // Get the lease to find the unit and property
        const { data: lease, error: leaseError } = await supabase
          .from('lease')
          .select(`
            unit_id,
            property_id,
            unit:units(
              id,
              buildium_unit_id,
              property_id,
              property:properties(
                id,
                buildium_property_id
              )
            )
          `)
          .eq('id', transaction.lease_id)
          .single()

        if (leaseError) {
          console.error(`Failed to find lease for line ${line.id}: ${leaseError.message}`)
          continue
        }

        // Update the transaction line with property and unit relationships
        const { error: updateError } = await supabase
          .from('transaction_lines')
          .update({
            property_id: lease.property_id,
            unit_id: lease.unit_id,
            buildium_property_id: lease.unit?.property?.buildium_property_id,
            buildium_unit_id: lease.unit?.buildium_unit_id
          })
          .eq('id', line.id)

        if (updateError) {
          console.error(`Failed to update transaction line ${line.id}: ${updateError.message}`)
        } else {
          console.log(`✅ Updated transaction line ${line.id} with property_id: ${lease.property_id}, unit_id: ${lease.unit_id}`)
        }
      }
    } else {
      console.log('No transaction lines found that need property_id/unit_id population')
    }

    console.log('\n🎉 Successfully populated all relationships!')

    // 3. Verification
    console.log('\n📊 Verification Summary:')
    
    const { data: transactionCount } = await supabase
      .from('transactions')
      .select('id', { count: 'exact' })
      .not('lease_id', 'is', null)
    
    const { data: transactionLinesCount } = await supabase
      .from('transaction_lines')
      .select('id', { count: 'exact' })
      .not('property_id', 'is', null)
    
    console.log(`   ✅ Transactions with lease relationship: ${transactionCount || 0}`)
    console.log(`   ✅ Transaction lines with property relationship: ${transactionLinesCount || 0}`)

  } catch (error) {
    console.error('❌ Error populating relationships:', error)
    throw error
  }
}

// Run the script
populateRelationships()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
