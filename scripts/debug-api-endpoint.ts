import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugAPIEndpoint() {
  console.log('🔍 Debugging API endpoint...\n')

  const propertyId = '67afb0d5-e43c-4db0-adaf-29d4cc019c9a'
  const today = new Date().toISOString().slice(0, 10)

  // 1. Test the RPC function directly
  console.log('1. Testing get_property_financials RPC directly:')
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_property_financials', {
    p_property_id: propertyId,
    p_as_of: today
  })
  
  if (rpcError) {
    console.error('❌ RPC Error:', rpcError.message)
    return
  }

  console.log('   RPC Response:', JSON.stringify(rpcData, null, 2))

  // 2. Test the cached property values directly
  console.log('\n2. Testing cached property values:')
  const { data: propertyData, error: propertyError } = await supabase
    .from('properties')
    .select('id, name, cash_balance, security_deposits, available_balance, reserve, cash_updated_at')
    .eq('id', propertyId)
    .single()
  
  if (propertyError) {
    console.error('❌ Property Error:', propertyError.message)
  } else {
    console.log('   Property Data:', JSON.stringify(propertyData, null, 2))
  }

  // 3. Test the API endpoint URL that the UI is calling
  console.log('\n3. Testing API endpoint URL:')
  const apiUrl = `http://localhost:3000/api/properties/${propertyId}/financials?asOf=${today}`
  console.log(`   URL: ${apiUrl}`)
  
  try {
    const response = await fetch(apiUrl)
    console.log(`   Status: ${response.status} ${response.statusText}`)
    
    if (response.ok) {
      const apiData = await response.json()
      console.log('   API Response:', JSON.stringify(apiData, null, 2))
      
      // Compare with RPC
      if (JSON.stringify(rpcData) === JSON.stringify(apiData)) {
        console.log('   ✅ API matches RPC!')
      } else {
        console.log('   ❌ API differs from RPC!')
        console.log('   RPC:', JSON.stringify(rpcData))
        console.log('   API:', JSON.stringify(apiData))
      }
    } else {
      const errorText = await response.text()
      console.log('   Error Response:', errorText)
    }
  } catch (e) {
    console.log('   ❌ API call failed:', e.message)
    console.log('   This is expected if the dev server is not running')
  }

  console.log('\n✅ Debug complete!')
}

debugAPIEndpoint().catch(console.error)
