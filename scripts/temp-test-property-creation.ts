import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testPropertyCreation() {
  try {
    console.log('🧪 Testing property creation...')
    
    // Test data
    const testProperty = {
      name: "Test Property",
      structure_description: "Test apartment building",
      address_line1: "123 Test Street",
      address_line2: null,
      city: "Test City",
      state: "CA",
      postal_code: "12345",
      country: "United States",
      rental_sub_type: "MultiFamily",
      operating_bank_account_id: null,
      deposit_trust_account_id: null,
      reserve: 1000.00,
      year_built: 2020,
      status: "Active",
      rental_owner_ids: []
    }
    
    console.log('📝 Attempting to insert test property...')
    const { data: property, error: insertError } = await supabase
      .from('properties')
      .insert(testProperty)
      .select()
      .single()
    
    if (insertError) {
      console.error('❌ Error inserting property:', insertError)
      console.error('Error details:', JSON.stringify(insertError, null, 2))
      return
    }
    
    console.log('✅ Successfully created test property:', property)
    
    // Verify it was created
    const { data: verifyProperty, error: verifyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', property.id)
      .single()
    
    if (verifyError) {
      console.error('❌ Error verifying property:', verifyError)
    } else {
      console.log('✅ Property verified in database:', verifyProperty)
    }
    
    // Clean up - delete the test property
    console.log('🧹 Cleaning up test property...')
    const { error: deleteError } = await supabase
      .from('properties')
      .delete()
      .eq('id', property.id)
    
    if (deleteError) {
      console.error('❌ Error deleting test property:', deleteError)
    } else {
      console.log('✅ Test property cleaned up')
    }
    
  } catch (error) {
    console.error('❌ Error testing property creation:', error)
  }
}

testPropertyCreation()
