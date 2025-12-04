import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkPropertyCashBalance() {
  console.log('🔍 Checking property cash balances...\n')

  // 1. Check cached values in properties table
  console.log('1. Checking cached values in properties table:')
  const { data: props, error: propsError } = await supabase
    .from('properties')
    .select('id, name, cash_balance, security_deposits, available_balance, reserve, cash_updated_at')
    .limit(5)
  
  if (propsError) {
    console.error('   ❌ Error:', propsError.message)
  } else {
    console.log(`   Found ${props?.length || 0} properties:\n`)
    props?.forEach(p => {
      console.log(`   Property: ${p.name}`)
      console.log(`   - Cash Balance: $${p.cash_balance || 0}`)
      console.log(`   - Security Deposits: $${p.security_deposits || 0}`)
      console.log(`   - Reserve: $${p.reserve || 0}`)
      console.log(`   - Available: $${p.available_balance || 0}`)
      console.log(`   - Updated At: ${p.cash_updated_at || 'never'}`)
      console.log()
    })
  }

  // 2. Check transaction_lines for a property to see if there's actual data
  console.log('\n2. Checking transaction_lines for bank account activity:')
  const { data: txLines, error: txError } = await supabase
    .from('transaction_lines')
    .select(`
      id,
      amount,
      posting_type,
      property_id,
      gl_accounts!inner(
        id,
        name,
        is_bank_account,
        exclude_from_cash_balances
      )
    `)
    .eq('gl_accounts.is_bank_account', true)
    .limit(10)
  
  if (txError) {
    console.error('   ❌ Error:', txError.message)
  } else {
    console.log(`   Found ${txLines?.length || 0} bank account transactions`)
    if (txLines && txLines.length > 0) {
      const sample = txLines[0]
      console.log(`   Sample: $${sample.amount} ${sample.posting_type} to ${(sample.gl_accounts as any).name}`)
    }
  }

  // 3. Test the get_property_financials function for a specific property
  if (props && props.length > 0) {
    const testProp = props[0]
    console.log(`\n3. Testing get_property_financials for "${testProp.name}":`)
    const { data: finData, error: finError } = await supabase.rpc('get_property_financials', {
      p_property_id: testProp.id,
      p_as_of: new Date().toISOString().slice(0, 10)
    })
    
    if (finError) {
      console.error('   ❌ Error:', finError.message)
    } else {
      console.log('   Function returned:')
      console.log(`   - Cash Balance: $${finData.cash_balance}`)
      console.log(`   - Security Deposits: $${finData.security_deposits}`)
      console.log(`   - Reserve: $${finData.reserve}`)
      console.log(`   - Available: $${finData.available_balance}`)
    }
  }

  console.log('\n✅ Check complete!')
}

checkPropertyCashBalance().catch(console.error)


