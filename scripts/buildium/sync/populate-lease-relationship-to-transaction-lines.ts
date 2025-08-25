import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function populateLeaseRelationshipToTransactionLines() {
  console.log('🔄 Populating lease relationship to transaction lines...')

  try {
    // Get all transaction lines that have a transaction_id but no lease_id
    const { data: transactionLines, error: fetchError } = await supabase
      .from('transaction_lines')
      .select(`
        id,
        transaction_id,
        transaction:transactions!inner(
          lease_id,
          buildium_lease_id
        )
      `)
      .is('lease_id', null)

    if (fetchError) {
      throw new Error(`Failed to fetch transaction lines: ${fetchError.message}`)
    }

    if (!transactionLines || transactionLines.length === 0) {
      console.log('✅ No transaction lines found that need lease relationship population')
      return
    }

    console.log(`📝 Found ${transactionLines.length} transaction lines to update`)

    // Update each transaction line with lease relationship
    for (const entry of transactionLines) {
      const { error: updateError } = await supabase
        .from('transaction_lines')
        .update({
          lease_id: entry.transaction.lease_id,
          buildium_lease_id: entry.transaction.buildium_lease_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', entry.id)

      if (updateError) {
        console.error(`❌ Failed to update transaction line ${entry.id}: ${updateError.message}`)
      } else {
        console.log(`✅ Updated transaction line ${entry.id} with lease_id: ${entry.transaction.lease_id}, buildium_lease_id: ${entry.transaction.buildium_lease_id}`)
      }
    }

    console.log('🎉 Successfully populated lease relationships for all transaction lines')

    // Verify the updates
    const { data: verificationData, error: verificationError } = await supabase
      .from('transaction_lines')
      .select(`
        id,
        lease_id,
        buildium_lease_id,
        transaction:transactions(
          lease_id,
          buildium_lease_id
        )
      `)
      .not('lease_id', 'is', null)

    if (verificationError) {
      throw new Error(`Failed to verify updates: ${verificationError.message}`)
    }

    console.log(`\n📊 Verification Summary:`)
    console.log(`Total transaction lines with lease relationship: ${verificationData?.length || 0}`)
    
    if (verificationData && verificationData.length > 0) {
      console.log(`Sample entry:`)
      console.log(`  Transaction Line ID: ${verificationData[0].id}`)
      console.log(`  Lease ID: ${verificationData[0].lease_id}`)
      console.log(`  Buildium Lease ID: ${verificationData[0].buildium_lease_id}`)
      console.log(`  Transaction Lease ID: ${verificationData[0].transaction?.lease_id}`)
      console.log(`  Transaction Buildium Lease ID: ${verificationData[0].transaction?.buildium_lease_id}`)
    }

  } catch (error) {
    console.error('❌ Error populating lease relationship to transaction lines:', error)
    throw error
  }
}

// Run the script
populateLeaseRelationshipToTransactionLines()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
