import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function testPropertyAPI() {
  console.log('🧪 Testing property API endpoint...\n')

  const propertyId = '67afb0d5-e43c-4db0-adaf-29d4cc019c9a'

  // 1. Test the direct RPC function
  console.log('1. Testing get_property_financials RPC:')
  const { data: finData, error: finError } = await supabase.rpc('get_property_financials', {
    p_property_id: propertyId,
    p_as_of: new Date().toISOString().slice(0, 10)
  })
  
  if (finError) {
    console.error('❌ Error calling RPC:', finError.message)
  } else {
    console.log('   RPC returned:')
    console.log(`     Cash Balance: $${finData.cash_balance}`)
    console.log(`     Security Deposits: $${finData.security_deposits}`)
    console.log(`     Reserve: $${finData.reserve}`)
    console.log(`     Available Balance: $${finData.available_balance}`)
    console.log(`     As of: ${finData.as_of}`)
  }

  // 2. Test the API endpoint (simulate the HTTP call)
  console.log('\n2. Testing API endpoint:')
  try {
    const response = await fetch(`http://localhost:3000/api/properties/${propertyId}/financials`)
    if (response.ok) {
      const apiData = await response.json()
      console.log('   API returned:')
      console.log(`     Cash Balance: $${apiData.cash_balance}`)
      console.log(`     Security Deposits: $${apiData.security_deposits}`)
      console.log(`     Reserve: $${apiData.reserve}`)
      console.log(`     Available Balance: $${apiData.available_balance}`)
      console.log(`     As of: ${apiData.as_of}`)
      
      // Compare with RPC
      if (Math.abs(finData.cash_balance - apiData.cash_balance) < 0.01) {
        console.log('   ✅ API matches RPC function!')
      } else {
        console.log('   ❌ API mismatch with RPC function!')
      }
    } else {
      console.log(`   API request failed: ${response.status} ${response.statusText}`)
    }
  } catch (e) {
    console.log('   API test skipped (server not running or network error)')
  }

  // 3. Check cached property values
  console.log('\n3. Cached property values:')
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('cash_balance, security_deposits, available_balance, cash_updated_at')
    .eq('id', propertyId)
    .single()
  
  if (propError) {
    console.error('❌ Error getting property:', propError.message)
  } else {
    console.log('   Database cached values:')
    console.log(`     Cash Balance: $${property.cash_balance}`)
    console.log(`     Security Deposits: $${property.security_deposits}`)
    console.log(`     Available Balance: $${property.available_balance}`)
    console.log(`     Updated At: ${property.cash_updated_at}`)
  }

  console.log('\n✅ API test complete!')
  console.log('\n💡 If the UI still shows $0.00, check:')
  console.log('   1. Browser cache - try hard refresh (Ctrl+F5)')
  console.log('   2. API endpoint URL in the frontend')
  console.log('   3. Property ID being passed to the API')
  console.log('   4. Component state management')
}

testPropertyAPI().catch(console.error)

