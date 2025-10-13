import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function fixPropertyBankAndCreateTransaction() {
  console.log('🔧 Fixing property bank account setup and creating missing transaction...\n')

  // 1. Get the property
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, name, operating_bank_account_id')
    .limit(1)
    .single()
  
  if (propError) {
    console.error('❌ Error getting property:', propError.message)
    return
  }

  console.log(`Property: ${property.name}`)
  console.log(`Current Operating Bank Account ID: ${property.operating_bank_account_id}`)

  // 2. Get a suitable bank account GL (use "Seaport Operating" since it sounds property-specific)
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

  // 3. Update the property to use the correct bank account GL
  console.log('\nUpdating property bank account...')
  const { error: updateError } = await supabase
    .from('properties')
    .update({ operating_bank_account_id: bankGL.id })
    .eq('id', property.id)
  
  if (updateError) {
    console.error('❌ Error updating property:', updateError.message)
    return
  }

  console.log('✅ Property bank account updated')

  // 4. Get the existing rent income transaction
  const { data: rentTx, error: rentError } = await supabase
    .from('transaction_lines')
    .select('*')
    .single()
  
  if (rentError) {
    console.error('❌ Error getting rent transaction:', rentError.message)
    return
  }

  console.log(`\nExisting rent income transaction: $${rentTx.amount} ${rentTx.posting_type}`)

  // 5. Create the missing bank account transaction (Credit to increase cash)
  const bankTxData = {
    amount: rentTx.amount, // Same amount as rent income
    posting_type: 'Credit', // Credit increases bank account balance
    property_id: rentTx.property_id,
    unit_id: rentTx.unit_id,
    lease_id: rentTx.lease_id,
    date: rentTx.date,
    gl_account_id: bankGL.id,
    description: 'Rent payment received',
    reference: 'RENT-' + new Date().toISOString().slice(0, 10)
  }

  console.log('\nCreating bank account transaction:')
  console.log(`  Amount: $${bankTxData.amount} ${bankTxData.posting_type}`)
  console.log(`  GL Account: ${bankGL.name}`)

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

  // 6. Wait for triggers to process and check updated balance
  console.log('\nWaiting for triggers to process...')
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  const { data: updatedProp, error: updatePropError } = await supabase
    .from('properties')
    .select('cash_balance, security_deposits, available_balance, cash_updated_at')
    .eq('id', property.id)
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

  console.log('\n✅ All done! Property cash balance should now show $5.00')
}

fixPropertyBankAndCreateTransaction().catch(console.error)


