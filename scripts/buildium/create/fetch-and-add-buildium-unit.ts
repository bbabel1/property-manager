import { createClient } from '@supabase/supabase-js'
import { mapUnitFromBuildium } from '@/lib/buildium-mappers'
import * as dotenv from 'dotenv'

// Load environment variables - ALWAYS use .env.local for local development
dotenv.config({ path: '.env.local' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fetchBuildiumUnit(unitId: number) {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units/${unitId}`
  
  try {
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Buildium API error: ${response.status} ${response.statusText}`)
      console.error('Error response:', errorText)
      throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Unit data from Buildium:', JSON.stringify(data, null, 2))
    return data
  } catch (error) {
    console.error('Error fetching unit from Buildium:', error)
    throw error
  }
}

async function getPropertyByBuildiumId(buildiumPropertyId: number): Promise<string | null> {
  try {
    const { data: property, error } = await supabase
      .from('properties')
      .select('id')
      .eq('buildium_property_id', buildiumPropertyId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        console.log(`⚠️  Property with Buildium ID ${buildiumPropertyId} not found in local database`)
        return null
      }
      throw new Error(`Failed to get property: ${error.message}`)
    }

    console.log(`✅ Found property with Buildium ID ${buildiumPropertyId}: ${property.id}`)
    return property.id
  } catch (error) {
    console.error(`❌ Error looking up property with Buildium ID ${buildiumPropertyId}:`, error)
    return null
  }
}

async function fetchAndAddBuildiumUnit(unitId: number) {
  try {
    console.log(`🔍 Fetching Buildium unit ${unitId}...`)

    // Fetch unit from Buildium
    const buildiumUnit = await fetchBuildiumUnit(unitId)
    console.log('✅ Successfully fetched unit from Buildium:', buildiumUnit.Number)

    // Get the local property ID
    const localPropertyId = await getPropertyByBuildiumId(buildiumUnit.PropertyId)
    if (!localPropertyId) {
      throw new Error(`Property with Buildium ID ${buildiumUnit.PropertyId} not found in local database. Please sync the property first.`)
    }

    // Check if unit already exists in database
    const { data: existingUnits, error: checkError } = await supabase
      .from('units')
      .select('*')
      .eq('buildium_unit_id', unitId)

    if (checkError) {
      console.error('❌ Error checking existing unit:', checkError)
      throw checkError
    }

    // ✅ Use the mapper from buildium-mappers.ts
    console.log('🔄 Mapping unit with standard mapper...')
    const localData = mapUnitFromBuildium(buildiumUnit)
    
    // Add required timestamp fields
    const now = new Date().toISOString()
    const finalData = {
      ...localData,
      property_id: localPropertyId,
      created_at: now,
      updated_at: now
    }

    console.log('📋 Mapped unit data:', finalData)

    let unit
    let error

    if (existingUnits && existingUnits.length > 0) {
      // Update existing unit
      console.log(`🔄 Found existing unit, updating...`)
      const { data: updatedUnit, error: updateError } = await supabase
        .from('units')
        .update(finalData)
        .eq('id', existingUnits[0].id)
        .select()
        .single()
      
      unit = updatedUnit
      error = updateError
      
      if (error) {
        console.error('❌ Error updating unit:', error)
        throw error
      }
      
      console.log('✅ Successfully updated existing unit in database:', unit.id)
    } else {
      // Insert new unit
      console.log(`➕ Creating new unit in database...`)
      const { data: newUnit, error: insertError } = await supabase
        .from('units')
        .insert(finalData)
        .select()
        .single()
      
      unit = newUnit
      error = insertError
      
      if (error) {
        console.error('❌ Error inserting unit:', error)
        throw error
      }
      
      console.log('✅ Successfully added new unit to database:', unit.id)
    }

    console.log('🎉 Unit sync completed successfully!')
    console.log('📊 Unit details:')
    console.log(`   - Local ID: ${unit.id}`)
    console.log(`   - Buildium ID: ${unit.buildium_unit_id}`)
    console.log(`   - Unit Number: ${unit.unit_number}`)
    console.log(`   - Property ID: ${unit.property_id}`)
    console.log(`   - Type: ${unit.unit_type}`)
    console.log(`   - Bedrooms: ${unit.bedrooms}`)
    console.log(`   - Bathrooms: ${unit.bathrooms}`)
    console.log(`   - Status: ${unit.is_active ? 'Active' : 'Inactive'}`)

    return unit

  } catch (error) {
    console.error('❌ Failed to fetch and add unit:', error)
    throw error
  }
}

// Run the script
if (require.main === module) {
  const args = process.argv.slice(2)
  const unitId = args[0] ? parseInt(args[0]) : undefined
  
  if (!unitId || isNaN(unitId)) {
    console.error('❌ Invalid unit ID. Please provide a valid number.')
    console.log('Usage: npx tsx scripts/buildium/create/fetch-and-add-buildium-unit.ts <unitId>')
    process.exit(1)
  }
  
  fetchAndAddBuildiumUnit(unitId)
    .then(() => {
      console.log('🎯 Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Script failed:', error)
      process.exit(1)
    })
}

export { fetchAndAddBuildiumUnit }
