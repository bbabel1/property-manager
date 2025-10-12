import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function testSummaryPageFix() {
  console.log('🧪 Testing summary page fix...\n')

  const propertyId = '67afb0d5-e43c-4db0-adaf-29d4cc019c9a'
  const today = new Date().toISOString().slice(0, 10)

  // Test the RPC call that the summary page now uses
  console.log('1. Testing get_property_financials RPC (same as summary page):')
  const { data, error } = await supabase.rpc('get_property_financials', {
    p_property_id: propertyId,
    p_as_of: today
  })
  
  if (error) {
    console.error('❌ RPC Error:', error.message)
    return
  }

  console.log('   RPC Response:')
  console.log(`     cash_balance: $${data.cash_balance}`)
  console.log(`     security_deposits: $${data.security_deposits}`)
  console.log(`     reserve: $${data.reserve}`)
  console.log(`     available_balance: $${data.available_balance}`)
  console.log(`     as_of: ${data.as_of}`)

  // Test the UI formatting
  console.log('\n2. UI Display Format (what the user should see):')
  console.log(`   Cash balance: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.cash_balance || 0)}`)
  console.log(`   Security deposits: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.security_deposits || 0)}`)
  console.log(`   Reserve: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.reserve || 0)}`)
  console.log(`   Available balance: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.available_balance || 0)}`)

  if (data.cash_balance > 0) {
    console.log('\n✅ SUCCESS! The summary page should now show:')
    console.log(`   - Cash balance: $${data.cash_balance} (instead of $0.00)`)
    console.log(`   - Available balance: $${data.available_balance} (instead of $0.00)`)
  } else {
    console.log('\n❌ ISSUE: Cash balance is still $0.00')
  }

  console.log('\n✅ Test complete!')
  console.log('\n💡 Summary of changes:')
  console.log('   - Summary page now calls RPC directly instead of API endpoint')
  console.log('   - Uses supabaseAdmin for proper authentication')
  console.log('   - Should bypass the 401 Unauthorized issue')
  console.log('   - UI components already updated to use fin?.cash_balance')
}

testSummaryPageFix().catch(console.error)
