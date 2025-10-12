import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function createBankTransactionOnly() {
  console.log('🔧 Creating missing bank account transaction...\n')

  // 1. Get the existing rent income transaction
  const { data: rentTx, error: rentError } = await supabase
    .from('transaction_lines')
    .select('*')
    .single()
  
  if (rentError) {
    console.error('❌ Error getting rent transaction:', rentError.message)
    return
  }

  console.log(`Existing rent income transaction: $${rentTx.amount} ${rentTx.posting_type}`)

  // 2. Use one of the available bank account GLs directly
  const { data: bankGL, error: bankError } = await supabase
    .from('gl_accounts')
    .select('id, name')
    .eq('name', 'Seaport Operating')
    .single()
  
  if (bankError) {
    console.error('❌ Error getting bank GL:', bankError.message)
    return
  }

  console.log(`Using bank GL: ${bankGL.name} (${bankGL.id})`)

  // 3. Create the missing bank account transaction (Credit to increase cash)
  const bankTxData = {
    amount: rentTx.amount, // Same amount as rent income
    posting_type: 'Credit', // Credit increases bank account balance
    property_id: rentTx.property_id,
    unit_id: rentTx.unit_id,
    lease_id: rentTx.lease_id,
    date: rentTx.date,
    gl_account_id: bankGL.id,
    account_entity_type: rentTx.account_entity_type,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  console.log('\nCreating bank account transaction:')
  console.log(`  Amount: $${bankTxData.amount} ${bankTxData.posting_type}`)
  console.log(`  GL Account: ${bankGL.name}`)
  console.log(`  Property: ${bankTxData.property_id}`)
  console.log(`  Unit: ${bankTxData.unit_id}`)

  const { data: newTx, error: insertError } = await supabase
    .from('transaction_lines')
    .insert(bankTxData)
    .select()
    .single()
  
  if (insertError) {
    console.error('❌ Error creating bank transaction:', insertError.message)
    return
  }

  console.log(`✅ Created bank transaction: ${newTx.id}`)

  // 4. Wait for triggers to process and check updated balance
  console.log('\nWaiting for triggers to process...')
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  const { data: updatedProp, error: updatePropError } = await supabase
    .from('properties')
    .select('cash_balance, security_deposits, available_balance, cash_updated_at')
    .eq('id', rentTx.property_id)
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

  // 5. Test the API endpoint
  console.log('\nTesting API endpoint...')
  try {
    const response = await fetch(`http://localhost:3000/api/properties/${rentTx.property_id}/financials`)
    if (response.ok) {
      const finData = await response.json()
      console.log('API returned:')
      console.log(`  Cash Balance: $${finData.cash_balance}`)
      console.log(`  Available Balance: $${finData.available_balance}`)
    } else {
      console.log('API request failed:', response.status)
    }
  } catch (e) {
    console.log('API test skipped (server not running)')
  }

  console.log('\n✅ All done! Property cash balance should now show $5.00')
}

createBankTransactionOnly().catch(console.error)

