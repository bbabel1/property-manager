import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function fixBankTransactionPosting() {
  console.log('🔧 Fixing bank transaction posting type...\n')

  // 1. Get the bank transaction we just created
  const { data: bankTx, error: bankTxError } = await supabase
    .from('transaction_lines')
    .select('*')
    .eq('gl_account_id', '6ab564b5-958e-4bbf-913b-a7cf2370eabe') // Seaport Operating
    .single()
  
  if (bankTxError) {
    console.error('❌ Error getting bank transaction:', bankTxError.message)
    return
  }

  console.log(`Current bank transaction: $${bankTx.amount} ${bankTx.posting_type}`)
  console.log(`Current cash balance: $-5 (incorrect)`)

  // 2. Update the posting type from Credit to Debit
  console.log('\nUpdating posting type from Credit to Debit...')
  const { error: updateError } = await supabase
    .from('transaction_lines')
    .update({ posting_type: 'Debit' })
    .eq('id', bankTx.id)
  
  if (updateError) {
    console.error('❌ Error updating transaction:', updateError.message)
    return
  }

  console.log('✅ Transaction updated to Debit')

  // 3. Wait for triggers to process and check updated balance
  console.log('\nWaiting for triggers to process...')
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  const { data: updatedProp, error: updatePropError } = await supabase
    .from('properties')
    .select('cash_balance, security_deposits, available_balance, cash_updated_at')
    .eq('id', bankTx.property_id)
    .single()
  
  if (updatePropError) {
    console.error('❌ Error getting updated property:', updatePropError.message)
  } else {
    console.log('Updated property cash balance:')
    console.log(`  Cash Balance: $${updatedProp.cash_balance}`)
    console.log(`  Security Deposits: $${updatedProp.security_deposits}`)
    console.log(`  Available Balance: $${updatedProp.available_balance}`)
    console.log(`  Updated At: ${updatedProp.cash_updated_at}`)
  }

  console.log('\n✅ Bank transaction fixed! Cash balance should now show $5.00')
}

fixBankTransactionPosting().catch(console.error)

