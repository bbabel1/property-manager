const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = "http://127.0.0.1:54321"
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testPropertyFetch() {
  try {
    console.log('Testing property fetch for ID: 75180019-ae17-41c6-a0f8-da687c1541ab')
    
    // Test 1: Check if property exists
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', '75180019-ae17-41c6-a0f8-da687c1541ab')
      .single()

    if (propertyError) {
      console.log('Property not found (expected):', propertyError.message)
      console.log('Property error object:', JSON.stringify(propertyError, null, 2))
    } else {
      console.log('Property found:', property.name)
    }

    // Test 2: Check ownership query
    const { data: ownership, error: ownershipError } = await supabase
      .from('ownerships')
      .select(`
        *,
        owners!inner (
          *,
          contacts (*)
        )
      `)
      .eq('property_id', '75180019-ae17-41c6-a0f8-da687c1541ab')

    if (ownershipError) {
      console.log('Ownership query error:', ownershipError.message)
      console.log('Ownership error object:', JSON.stringify(ownershipError, null, 2))
    } else {
      console.log('Ownership query success:', ownership?.length || 0, 'records')
    }

    // Test 3: Simulate the property service logic
    console.log('\n--- Testing Property Service Logic ---')
    if (propertyError) {
      console.log('❌ Error fetching property:', propertyError)
      console.log('Returning null as expected')
    } else {
      console.log('✅ Property found, continuing with other queries')
    }

  } catch (err) {
    console.error('Unexpected error:', err)
    console.error('Error object:', JSON.stringify(err, null, 2))
  }
}

testPropertyFetch()
