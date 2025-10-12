import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUnitBalances() {
  console.log('🔍 Checking unit balances and property relationships...\n')

  // 1. Get the property first
  console.log('1. Property details:')
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, name')
    .limit(1)
    .single()
  
  if (propError) {
    console.error('   ❌ Error:', propError.message)
    return
  }

  console.log(`   Property: ${property.name} (${property.id})`)

  // 2. Get units for this property
  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id, unit_number, property_id')
    .eq('property_id', property.id)
  
  if (unitsError) {
    console.error('   ❌ Error getting units:', unitsError.message)
    return
  }

  console.log(`   Units: ${units?.length || 0}`)
  units?.forEach(unit => {
    console.log(`   - Unit ${unit.unit_number} (${unit.id})`)
  })

  // 3. Check transaction lines for units
  console.log('\n2. Unit transaction lines:')
  if (units && units.length > 0) {
    for (const unit of units) {
      const { data: txLines, error: txError } = await supabase
        .from('transaction_lines')
        .select(`
          id,
          amount,
          posting_type,
          unit_id,
          gl_accounts!inner(
            id,
            name,
            is_bank_account
          )
        `)
        .eq('unit_id', unit.id)
        .limit(10)
      
      if (txError) {
        console.error(`   ❌ Error for unit ${unit.unit_number}:`, txError.message)
      } else {
        console.log(`   Unit ${unit.unit_number}: ${txLines?.length || 0} transactions`)
        txLines?.forEach(tx => {
          const isBank = (tx.gl_accounts as any).is_bank_account
          console.log(`     - $${tx.amount} ${tx.posting_type} to ${(tx.gl_accounts as any).name} (bank: ${isBank})`)
        })
      }
    }
  }

  // 4. Check transaction lines for the property directly
  console.log('\n3. Property transaction lines:')
  const { data: propTxLines, error: propTxError } = await supabase
    .from('transaction_lines')
    .select(`
      id,
      amount,
      posting_type,
      property_id,
      unit_id,
      gl_accounts!inner(
        id,
        name,
        is_bank_account
      )
    `)
    .eq('property_id', property.id)
    .limit(10)
  
  if (propTxError) {
    console.error('   ❌ Error:', propTxError.message)
  } else {
    console.log(`   Property direct: ${propTxLines?.length || 0} transactions`)
    propTxLines?.forEach(tx => {
      const isBank = (tx.gl_accounts as any).is_bank_account
      const unitInfo = tx.unit_id ? ` (unit: ${tx.unit_id})` : ''
      console.log(`     - $${tx.amount} ${tx.posting_type} to ${(tx.gl_accounts as any).name} (bank: ${isBank})${unitInfo}`)
    })
  }

  // 5. Calculate what the property cash balance should be
  console.log('\n4. Calculating expected property cash balance:')
  
  // Get all bank account transactions for this property (including units)
  const unitIds = units?.map(u => u.id) || []
  const unitFilter = unitIds.length > 0 ? `unit_id.in.(${unitIds.join(',')})` : 'unit_id.is.null'
  
  const { data: allBankTx, error: bankTxError } = await supabase
    .from('transaction_lines')
    .select(`
      id,
      amount,
      posting_type,
      property_id,
      unit_id,
      gl_accounts!inner(
        id,
        name,
        is_bank_account,
        exclude_from_cash_balances
      )
    `)
    .or(`property_id.eq.${property.id},${unitFilter}`)
    .eq('gl_accounts.is_bank_account', true)
    .eq('gl_accounts.exclude_from_cash_balances', false)
  
  if (bankTxError) {
    console.error('   ❌ Error:', bankTxError.message)
  } else {
    console.log(`   Found ${allBankTx?.length || 0} bank account transactions`)
    
    let totalCash = 0
    allBankTx?.forEach(tx => {
      const amount = tx.posting_type === 'Debit' ? tx.amount : -tx.amount
      totalCash += amount
      const source = tx.property_id ? 'property' : 'unit'
      console.log(`     - $${tx.amount} ${tx.posting_type} = $${amount} (${(tx.gl_accounts as any).name}, ${source})`)
    })
    
    console.log(`   Expected cash balance: $${totalCash}`)
    
    // Get current cached balance
    const { data: currentProp, error: currentError } = await supabase
      .from('properties')
      .select('cash_balance')
      .eq('id', property.id)
      .single()
    
    if (!currentError && currentProp) {
      console.log(`   Current cached balance: $${currentProp.cash_balance || 0}`)
    }
  }

  console.log('\n✅ Check complete!')
}

checkUnitBalances().catch(console.error)

