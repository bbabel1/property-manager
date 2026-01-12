import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

config({ path: '.env.local' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addUnit20616() {
  try {
    await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
    console.log('🔍 Adding unit 20616 to property 7647...')
    
    // Get the property ID for Buildium property 7647
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id')
      .eq('buildium_property_id', 7647)
      .single()

    if (propertyError) {
      console.error('❌ Error finding property:', propertyError)
      throw propertyError
    }

    console.log('✅ Found property:', property.id)

    // Check if unit already exists
    const { data: existingUnit, error: checkError } = await supabase
      .from('units')
      .select('*')
      .eq('buildium_unit_id', 20616)

    if (checkError) {
      console.error('❌ Error checking existing unit:', checkError)
      throw checkError
    }

    if (existingUnit && existingUnit.length > 0) {
      console.log('⚠️ Unit already exists:', existingUnit[0].id)
      return existingUnit[0].id
    }

    // Create the unit with minimal required fields
    const unitData = {
      buildium_unit_id: 20616,
      buildium_property_id: 7647,
      property_id: property.id,
      unit_number: '1A',
      building_name: '325 Lexington | Brandon Babel',
      description: '',
      market_rent: 0,
      address_line1: '325 Lexington Ave',
      address_line2: '',
      address_line3: '',
      city: 'New York',
      state: 'NY',
      postal_code: '10016',
      country: 'United States',
      unit_bedrooms: null,
      unit_bathrooms: '1',
      unit_size: 0,
      is_active: true,
      status: 'Occupied',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    console.log('📋 Unit data:', unitData)

    // Insert the unit
    const { data: newUnit, error: insertError } = await supabase
      .from('units')
      .insert(unitData)
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error inserting unit:', insertError)
      throw insertError
    }

    console.log('✅ Successfully added unit:', newUnit.id)
    console.log('📊 Unit details:')
    console.log(`   - Local ID: ${newUnit.id}`)
    console.log(`   - Buildium ID: ${newUnit.buildium_unit_id}`)
    console.log(`   - Unit Number: ${newUnit.unit_number}`)
    console.log(`   - Property ID: ${newUnit.property_id}`)
    console.log(`   - Status: ${newUnit.status}`)

    return newUnit.id

  } catch (error) {
    console.error('❌ Failed to add unit:', error)
    throw error
  }
}

// Run the script
addUnit20616()
  .then(() => {
    console.log('🎯 Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })
