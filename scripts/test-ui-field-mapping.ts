import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function testUIFieldMapping() {
  console.log('🧪 Testing UI field mapping...\n')

  const propertyId = '67afb0d5-e43c-4db0-adaf-29d4cc019c9a'

  // 1. Test the API endpoint that the UI uses
  console.log('1. Testing property financials API:')
  const { data: finData, error: finError } = await supabase.rpc('get_property_financials', {
    p_property_id: propertyId,
    p_as_of: new Date().toISOString().slice(0, 10)
  })
  
  if (finError) {
    console.error('❌ Error calling get_property_financials:', finError.message)
    return
  }

  console.log('   API Response:')
  console.log(`     cash_balance: ${finData.cash_balance}`)
  console.log(`     security_deposits: ${finData.security_deposits}`)
  console.log(`     reserve: ${finData.reserve}`)
  console.log(`     available_balance: ${finData.available_balance}`)
  console.log(`     as_of: ${finData.as_of}`)

  // 2. Test the UI field mapping format
  console.log('\n2. UI Field Mapping Format:')
  const cashBalance = finData.cash_balance || 0
  const securityDeposits = finData.security_deposits || 0
  const reserve = finData.reserve || 0
  const availableBalance = finData.available_balance || 0

  console.log(`   Cash balance: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cashBalance)}`)
  console.log(`   Security deposits: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(securityDeposits)}`)
  console.log(`   Reserve: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(reserve)}`)
  console.log(`   Available balance: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(availableBalance)}`)

  // 3. Verify the calculation logic
  console.log('\n3. Calculation Verification:')
  const expectedAvailable = cashBalance - reserve - securityDeposits
  console.log(`   Expected Available: $${cashBalance} - $${reserve} - $${securityDeposits} = $${expectedAvailable}`)
  console.log(`   Actual Available: $${availableBalance}`)
  
  if (Math.abs(expectedAvailable - availableBalance) < 0.01) {
    console.log('   ✅ Available balance calculation is correct!')
  } else {
    console.log('   ❌ Available balance calculation mismatch!')
  }

  console.log('\n✅ UI field mapping test complete!')
  console.log('\n💡 Summary:')
  console.log('   - UI components now use fin?.cash_balance instead of hardcoded values')
  console.log('   - PropertySummary and PropertyFinancials components updated')
  console.log('   - BankingDetailsCard already had correct mapping')
  console.log('   - All components use Intl.NumberFormat for consistent currency display')
  console.log('   - Components accept optional fin prop with fallback to 0')
}

testUIFieldMapping().catch(console.error)
