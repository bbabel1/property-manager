import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function fixPropertyCashCalculation() {
  console.log('🔧 Fixing property cash balance calculation to match unit balance logic...\n')

  // 1. Check current property cash balance calculation
  console.log('1. Current property cash balance (transaction_lines approach):')
  const propertyId = '67afb0d5-e43c-4db0-adaf-29d4cc019c9a'
  
  const { data: currentProp, error: currentError } = await supabase
    .from('properties')
    .select('cash_balance, available_balance')
    .eq('id', propertyId)
    .single()
  
  if (!currentError && currentProp) {
    console.log(`   Cash Balance: $${currentProp.cash_balance}`)
    console.log(`   Available Balance: $${currentProp.available_balance}`)
  }

  // 2. Calculate what it should be using unit balance logic (transactions approach)
  console.log('\n2. Calculating using unit balance logic (transactions approach):')
  
  // Get all leases for this property
  const { data: leases, error: leasesError } = await supabase
    .from('lease')
    .select('id')
    .eq('property_id', propertyId)
  
  if (leasesError) {
    console.error('❌ Error getting leases:', leasesError.message)
    return
  }

  console.log(`   Found ${leases?.length || 0} leases for property`)

  if (leases && leases.length > 0) {
    const leaseIds = leases.map(l => l.id)
    
    // Get transactions for these leases
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

    console.log(`   Found ${transactions?.length || 0} transactions`)

    // Get transaction type signs
    const { data: signs, error: signsError } = await supabase
      .from('transaction_type_sign')
      .select('transaction_type, sign')
    
    if (signsError) {
      console.error('❌ Error getting transaction signs:', signsError.message)
      return
    }

    const signMap = new Map(signs?.map(s => [s.transaction_type, s.sign]) || [])
    
    // Calculate balance using unit logic
    let totalBalance = 0
    transactions?.forEach(tx => {
      const sign = signMap.get(tx.transaction_type) || 1
      const amount = tx.total_amount * sign
      totalBalance += amount
      console.log(`     ${tx.transaction_type}: $${tx.total_amount} × ${sign} = $${amount}`)
    })

    console.log(`   Total calculated balance: $${totalBalance}`)
    console.log(`   Current cached balance: $${currentProp?.cash_balance || 0}`)
    
    if (Math.abs(totalBalance - (currentProp?.cash_balance || 0)) > 0.01) {
      console.log('\n   ⚠️  MISMATCH: Property cash balance should be calculated using transactions, not transaction_lines!')
    } else {
      console.log('\n   ✅ Balance matches (coincidentally)')
    }
  }

  console.log('\n✅ Analysis complete!')
  console.log('\n💡 The property cash balance calculation should be updated to use:')
  console.log('   - transactions table (like units do)')
  console.log('   - transaction_type_sign lookup table')
  console.log('   - Sum of total_amount * sign for all property leases')
  console.log('   - This will ensure consistency with unit balance calculations')
}

fixPropertyCashCalculation().catch(console.error)

