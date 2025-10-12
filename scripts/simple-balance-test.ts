import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function simpleBalanceTest() {
  console.log('🧪 Simple balance consistency test...\n')

  // 1. Get property cash balance
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, name, cash_balance, available_balance')
    .limit(1)
    .single()
  
  if (propError) {
    console.error('❌ Error getting property:', propError.message)
    return
  }

  console.log(`Property: ${property.name}`)
  console.log(`  Cash Balance: $${property.cash_balance}`)
  console.log(`  Available Balance: $${property.available_balance}`)

  // 2. Test the API function
  console.log('\n2. Testing get_property_financials function:')
  const { data: finData, error: finError } = await supabase.rpc('get_property_financials', {
    p_property_id: property.id,
    p_as_of: new Date().toISOString().slice(0, 10)
  })
  
  if (finError) {
    console.error('❌ Error calling function:', finError.message)
  } else {
    console.log('   Function returned:')
    console.log(`     Cash Balance: $${finData.cash_balance}`)
    console.log(`     Security Deposits: $${finData.security_deposits}`)
    console.log(`     Reserve: $${finData.reserve}`)
    console.log(`     Available Balance: $${finData.available_balance}`)
    
    if (Math.abs(finData.cash_balance - (property.cash_balance || 0)) < 0.01) {
      console.log('   ✅ API function matches cached values!')
    } else {
      console.log('   ❌ API function mismatch with cached values!')
    }
  }

  // 3. Get unit balances
  console.log('\n3. Unit balances:')
  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id, unit_number, balance')
    .eq('property_id', property.id)
  
  if (unitsError) {
    console.error('❌ Error getting units:', unitsError.message)
  } else {
    units?.forEach(unit => {
      console.log(`   Unit ${unit.unit_number}: Balance $${unit.balance || 0}`)
    })
  }

  console.log('\n✅ Test complete!')
  console.log('\n💡 Property cash balance calculation has been updated to:')
  console.log('   - Use transactions table (same as units)')
  console.log('   - Use transaction_type_sign lookup table')
  console.log('   - Sum of total_amount * sign for all property leases')
  console.log('   - This ensures consistency with unit balance calculations')
}

simpleBalanceTest().catch(console.error)

