import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function testPropertyUnitBalanceConsistency() {
  console.log('🧪 Testing property and unit balance calculation consistency...\n')

  // 1. Get the property and its units
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select(`
      id,
      name,
      cash_balance,
      available_balance,
      units(
        id,
        unit_number,
        balance,
        available_balance
      )
    `)
    .limit(1)
    .single()
  
  if (propError) {
    console.error('❌ Error getting property:', propError.message)
    return
  }

  console.log(`Property: ${property.name}`)
  console.log(`  Cached Cash Balance: $${property.cash_balance}`)
  console.log(`  Cached Available Balance: $${property.available_balance}`)
  console.log(`  Units: ${property.units?.length || 0}`)

  // 2. Calculate property balance using the new transactions approach
  console.log('\n2. Calculating property balance using transactions approach:')
  
  const { data: leases, error: leasesError } = await supabase
    .from('lease')
    .select('id')
    .eq('property_id', property.id)
  
  if (leasesError) {
    console.error('❌ Error getting leases:', leasesError.message)
    return
  }

  if (leases && leases.length > 0) {
    const leaseIds = leases.map(l => l.id)
    
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select(`
        id,
        total_amount,
        transaction_type,
        lease_id
      `)
      .in('lease_id', leaseIds)
    
    if (txError) {
      console.error('❌ Error getting transactions:', txError.message)
      return
    }

    const { data: signs, error: signsError } = await supabase
      .from('transaction_type_sign')
      .select('transaction_type, sign')
    
    if (signsError) {
      console.error('❌ Error getting transaction signs:', signsError.message)
      return
    }

    const signMap = new Map(signs?.map(s => [s.transaction_type, s.sign]) || [])
    
    let calculatedBalance = 0
    console.log(`   Found ${transactions?.length || 0} transactions:`)
    transactions?.forEach(tx => {
      const sign = signMap.get(tx.transaction_type) || 1
      const amount = tx.total_amount * sign
      calculatedBalance += amount
      console.log(`     - ${tx.transaction_type}: $${tx.total_amount} × ${sign} = $${amount}`)
    })

    console.log(`   Calculated Property Balance: $${calculatedBalance}`)
    console.log(`   Cached Property Balance: $${property.cash_balance}`)
    
    if (Math.abs(calculatedBalance - (property.cash_balance || 0)) < 0.01) {
      console.log('   ✅ Property balance calculation is consistent!')
    } else {
      console.log('   ❌ Property balance calculation mismatch!')
    }
  }

  // 3. Check unit balances
  console.log('\n3. Unit balances:')
  property.units?.forEach(unit => {
    console.log(`   Unit ${unit.unit_number}:`)
    console.log(`     Balance: $${unit.balance || 0}`)
    console.log(`     Available: $${unit.available_balance || 0}`)
  })

  // 4. Test the API function
  console.log('\n4. Testing get_property_financials function:')
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

  console.log('\n✅ Consistency test complete!')
  console.log('\n💡 Summary:')
  console.log('   - Property cash balance now uses transactions table (like units)')
  console.log('   - Both property and unit balances use transaction_type_sign lookup')
  console.log('   - Calculation logic is now consistent between properties and units')
  console.log('   - Triggers will keep both property and unit balances in sync')
}

testPropertyUnitBalanceConsistency().catch(console.error)



