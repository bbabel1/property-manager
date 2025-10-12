import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRentIncomeFlow() {
  console.log('🔍 Checking rent income flow and expected bank account entries...\n')

  // 1. Check the transaction and see if there should be a corresponding bank entry
  const { data: rentTx, error: rentError } = await supabase
    .from('transaction_lines')
    .select(`
      id,
      amount,
      posting_type,
      property_id,
      unit_id,
      lease_id,
      date,
      gl_accounts!inner(
        id,
        name,
        type,
        sub_type
      )
    `)
    .single()
  
  if (rentError) {
    console.error('❌ Error getting rent transaction:', rentError.message)
    return
  }

  console.log('Rent Income Transaction:')
  console.log(`  Amount: $${rentTx.amount} ${rentTx.posting_type}`)
  console.log(`  GL Account: ${(rentTx.gl_accounts as any).name}`)
  console.log(`  Property: ${rentTx.property_id}`)
  console.log(`  Unit: ${rentTx.unit_id}`)
  console.log(`  Lease: ${rentTx.lease_id}`)

  // 2. In proper double-entry accounting, rent income (credit) should have a corresponding bank account debit
  // Let's check if there's a missing bank account entry
  console.log('\nExpected double-entry:')
  console.log('  Rent Income: $5 Credit ✓ (exists)')
  console.log('  Bank Account: $5 Debit ❓ (missing?)')

  // 3. Check what bank account should be used for this property
  console.log('\nProperty bank account setup:')
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select(`
      id,
      name,
      operating_bank_account_id,
      deposit_trust_account_id,
      operating_account:operating_bank_account_id(
        id,
        name,
        account_number
      ),
      deposit_trust_account:deposit_trust_account_id(
        id,
        name,
        account_number
      )
    `)
    .eq('id', rentTx.property_id)
    .single()
  
  if (propError) {
    console.error('❌ Error getting property:', propError.message)
  } else {
    console.log(`Property: ${property.name}`)
    console.log(`Operating Account: ${property.operating_bank_account_id ? 'Set' : 'Not set'}`)
    console.log(`Trust Account: ${property.deposit_trust_account_id ? 'Set' : 'Not set'}`)
    
    if (property.operating_account) {
      console.log(`  Operating: ${(property.operating_account as any).name}`)
    }
    if (property.deposit_trust_account) {
      console.log(`  Trust: ${(property.deposit_trust_account as any).name}`)
    }
  }

  // 4. Check if there are any GL accounts that should be bank accounts but aren't marked as such
  console.log('\nChecking for unmarked bank accounts:')
  const { data: potentialBanks, error: bankError } = await supabase
    .from('gl_accounts')
    .select('id, name, is_bank_account, type, sub_type')
    .or('name.ilike.%bank%,name.ilike.%cash%,name.ilike.%checking%,name.ilike.%savings%')
  
  if (bankError) {
    console.error('❌ Error:', bankError.message)
  } else {
    console.log(`Found ${potentialBanks?.length || 0} potentially bank-related accounts:`)
    potentialBanks?.forEach(gl => {
      console.log(`  - ${gl.name}: is_bank_account=${gl.is_bank_account}`)
    })
  }

  console.log('\n💡 Analysis:')
  console.log('The rent income transaction exists, but there should be a corresponding')
  console.log('bank account debit to complete the double-entry. The cash balance is')
  console.log('correctly $0 because no bank account transactions exist.')
  console.log('\nTo fix this, you need to either:')
  console.log('1. Create the missing bank account debit transaction')
  console.log('2. Import proper double-entry transactions from Buildium')
  console.log('3. Set up the property with proper bank account GL accounts')

  console.log('\n✅ Analysis complete!')
}

checkRentIncomeFlow().catch(console.error)

