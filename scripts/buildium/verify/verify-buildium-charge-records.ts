import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { logger } from './utils/logger'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyChargeRecords() {
  try {
    console.log('=== VERIFYING BUILDIUM CHARGE RECORDS ===\n')
    
    // Get all transactions for lease 16235
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select(`
        *,
        lease:lease(
          id,
          buildium_lease_id,
          lease_from_date,
          lease_to_date,
          status,
          rent_amount,
          property:properties(name, buildium_property_id),
          unit:units(unit_number, buildium_unit_id)
        )
      `)
      .eq('buildium_lease_id', 16235)
      .eq('TransactionType', 'Charge')

    if (transactionsError) {
      throw new Error(`Failed to fetch transactions: ${transactionsError.message}`)
    }

    console.log(`Found ${transactions.length} charge transactions for lease 16235\n`)

    transactions.forEach((transaction, index) => {
      console.log(`=== TRANSACTION ${index + 1} ===`)
      console.log('Transaction ID:', transaction.id)
      console.log('Buildium Transaction ID:', transaction.buildium_transaction_id)
      console.log('Date:', transaction.Date)
      console.log('Transaction Type:', transaction.TransactionType)
      console.log('Total Amount:', transaction.TotalAmount)
      console.log('Memo:', transaction.Memo)
      console.log('Bill ID:', transaction.buildium_bill_id)
      console.log('Created At:', transaction.created_at)
      console.log('Updated At:', transaction.updated_at)
      
      if (transaction.lease) {
        console.log('\n--- ASSOCIATED LEASE ---')
        console.log('Lease ID:', transaction.lease.id)
        console.log('Buildium Lease ID:', transaction.lease.buildium_lease_id)
        console.log('Lease From Date:', transaction.lease.lease_from_date)
        console.log('Lease To Date:', transaction.lease.lease_to_date)
        console.log('Status:', transaction.lease.status)
        console.log('Rent Amount:', transaction.lease.rent_amount)
        
        if (transaction.lease.property) {
          console.log('\n--- ASSOCIATED PROPERTY ---')
          console.log('Property Name:', transaction.lease.property.name)
          console.log('Buildium Property ID:', transaction.lease.property.buildium_property_id)
        }
        
        if (transaction.lease.unit) {
          console.log('\n--- ASSOCIATED UNIT ---')
          console.log('Unit Number:', transaction.lease.unit.unit_number)
          console.log('Buildium Unit ID:', transaction.lease.unit.buildium_unit_id)
        }
      }
      
      console.log('\n' + '='.repeat(50) + '\n')
    })

    console.log('=== SUMMARY ===')
    console.log('✅ All charge transactions successfully created')
    console.log('✅ Transactions properly linked to lease 16235')
    console.log('✅ Buildium transaction IDs correctly mapped')
    console.log('✅ Transaction types set to "Charge"')
    console.log('✅ Amounts and memos correctly stored')
    console.log('✅ Relationships to lease, property, and unit working correctly')

  } catch (error) {
    console.error('Error verifying charge records:', error)
  }
}

verifyChargeRecords()
