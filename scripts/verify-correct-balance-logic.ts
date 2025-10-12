import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyCorrectBalanceLogic() {
  console.log('🔍 Verifying correct balance calculation logic...\n')

  const propertyId = '67afb0d5-e43c-4db0-adaf-29d4cc019c9a'

  // 1. Check property cash balance (should use bank GL accounts)
  console.log('1. Property Cash Balance (bank GL accounts):')
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, name, cash_balance, available_balance')
    .eq('id', propertyId)
    .single()
  
  if (propError) {
    console.error('❌ Error getting property:', propError.message)
    return
  }

  console.log(`   Property: ${property.name}`)
  console.log(`   Cached Cash Balance: $${property.cash_balance}`)
  console.log(`   Cached Available Balance: $${property.available_balance}`)

  // 2. Check bank GL transaction lines
  console.log('\n2. Bank GL Transaction Lines:')
  const { data: bankTxLines, error: bankError } = await supabase
    .from('transaction_lines')
    .select(`
      id,
      amount,
      posting_type,
      property_id,
      unit_id,
      lease_id,
      gl_accounts!inner(
        id,
        name,
        is_bank_account,
        exclude_from_cash_balances
      )
    `)
    .or(`property_id.eq.${propertyId},unit_id.in.((select id from units where property_id = '${propertyId}')),lease_id.in.((select id from lease where property_id = '${propertyId}'))`)
    .eq('gl_accounts.is_bank_account', true)
    .eq('gl_accounts.exclude_from_cash_balances', false)
  
  if (bankError) {
    console.error('❌ Error getting bank transaction lines:', bankError.message)
  } else {
    console.log(`   Found ${bankTxLines?.length || 0} bank GL transaction lines:`)
    
    let calculatedCash = 0
    bankTxLines?.forEach(tx => {
      const amount = tx.posting_type === 'Debit' ? tx.amount : -tx.amount
      calculatedCash += amount
      const source = tx.property_id ? 'property' : tx.unit_id ? 'unit' : 'lease'
      console.log(`     - $${tx.amount} ${tx.posting_type} = $${amount} (${(tx.gl_accounts as any).name}, ${source})`)
    })
    
    console.log(`   Calculated Cash Balance: $${calculatedCash}`)
    console.log(`   Cached Cash Balance: $${property.cash_balance}`)
    
    if (Math.abs(calculatedCash - (property.cash_balance || 0)) < 0.01) {
      console.log('   ✅ Property cash balance calculation is correct!')
    } else {
      console.log('   ❌ Property cash balance calculation mismatch!')
    }
  }

  // 3. Check unit balance (should use transactions)
  console.log('\n3. Unit Balance (transactions):')
  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id, unit_number, balance')
    .eq('property_id', propertyId)
  
  if (unitsError) {
    console.error('❌ Error getting units:', unitsError.message)
  } else {
    units?.forEach(unit => {
      console.log(`   Unit ${unit.unit_number}: Balance $${unit.balance || 0}`)
    })
  }

  // 4. Test the API function
  console.log('\n4. Testing get_property_financials function:')
  const { data: finData, error: finError } = await supabase.rpc('get_property_financials', {
    p_property_id: propertyId,
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
  }

  console.log('\n✅ Verification complete!')
  console.log('\n💡 Summary:')
  console.log('   - Unit Balance: Uses transactions table (Accounts Receivable)')
  console.log('   - Property Cash Balance: Uses transaction_lines with bank GL accounts')
  console.log('   - Credits reduce cash, debits increase cash')
  console.log('   - Available = Cash - Reserve - Security Deposits')
}

verifyCorrectBalanceLogic().catch(console.error)

