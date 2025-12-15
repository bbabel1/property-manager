import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function createMissingBankTransaction() {
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

  console.log('Existing rent income transaction:')
  console.log(`  ID: ${rentTx.id}`)
  console.log(`  Amount: $${rentTx.amount} ${rentTx.posting_type}`)

  // 2. Get the property's operating bank account GL
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('operating_bank_account_id')
    .eq('id', rentTx.property_id)
    .single()
  
  if (propError) {
    console.error('❌ Error getting property:', propError.message)
    return
  }

  // 3. Find the GL account for the operating bank account
  const { data: bankGL, error: bankGLError } = await supabase
    .from('gl_accounts')
    .select('id, name')
    .eq('id', property.operating_bank_account_id)
    .maybeSingle()
  
  if (bankGLError) {
    console.error('❌ Error getting bank GL:', bankGLError.message)
    return
  }

  if (!bankGL) {
    console.error('❌ No GL account found for operating bank account')
    return
  }

  console.log(`\nBank account GL: ${bankGL.name} (${bankGL.id})`)

  // 4. Create the missing bank account transaction (Credit to increase cash)
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

  console.log(`\n✅ Created bank transaction: ${newTx.id}`)

  // 5. Check the updated property cash balance
  console.log('\nChecking updated property cash balance...')
  
  // Wait a moment for triggers to process
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  const { data: updatedProp, error: updateError } = await supabase
    .from('properties')
    .select('cash_balance, security_deposits, available_balance, cash_updated_at')
    .eq('id', rentTx.property_id)
    .single()
  
  if (updateError) {
    console.error('❌ Error getting updated property:', updateError.message)
  } else {
    console.log('Updated property cash balance:')
    console.log(`  Cash Balance: $${updatedProp.cash_balance}`)
    console.log(`  Security Deposits: $${updatedProp.security_deposits}`)
    console.log(`  Available Balance: $${updatedProp.available_balance}`)
    console.log(`  Updated At: ${updatedProp.cash_updated_at}`)
  }

  console.log('\n✅ Transaction created successfully!')
}

createMissingBankTransaction().catch(console.error)
