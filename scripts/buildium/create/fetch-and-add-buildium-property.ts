import { createClient } from '@supabase/supabase-js'
import { mapPropertyFromBuildiumWithBankAccount } from '@/lib/buildium-mappers'
import * as dotenv from 'dotenv'
import { buildiumFetch } from '@/lib/buildium-http'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

// Load environment variables
dotenv.config({ path: '.env.local' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)



async function fetchBuildiumProperty(orgId: string, propertyId: number) {
  const res = await buildiumFetch('GET', `/rentals/${propertyId}`, undefined, undefined, orgId)

  if (!res.ok || !res.json) {
    const errorText = res.errorText || res.statusText
    throw new Error(`Buildium API error: ${res.status} ${errorText}`)
  }

  console.log('Property data from Buildium:', JSON.stringify(res.json, null, 2))
  return res.json as Record<string, unknown>
}

async function fetchAndAddBuildiumProperty(propertyId: number) {
  try {
    const { orgId } = await ensureBuildiumEnabledForScript()
    console.log(`🔍 Fetching Buildium property ${propertyId}...`)

    // Fetch property from Buildium
    const buildiumProperty = await fetchBuildiumProperty(orgId, propertyId)
    console.log('✅ Successfully fetched property from Buildium:', buildiumProperty.Name)

    // Check if property already exists in database
    const { data: existingProperties, error: checkError } = await supabase
      .from('properties')
      .select('*')
      .eq('buildium_property_id', propertyId)

    if (checkError) {
      console.error('❌ Error checking existing property:', checkError)
      throw checkError
    }

    // ✅ Use enhanced mapper that handles bank account relationships automatically
    console.log('🔄 Mapping property with enhanced mapper (includes bank account resolution)...')
    const localData = await mapPropertyFromBuildiumWithBankAccount(buildiumProperty, supabase)
    
    // Add required timestamp fields
    const now = new Date().toISOString()
    const finalData = {
      ...localData,
      created_at: now,
      updated_at: now
    }

    console.log('📋 Mapped property data:', finalData)

    let property
    let error

    if (existingProperties && existingProperties.length > 0) {
      // Update existing property
      console.log(`🔄 Found existing property, updating...`)
      const { data: updatedProperty, error: updateError } = await supabase
        .from('properties')
        .update(finalData)
        .eq('id', existingProperties[0].id)
        .select()
        .single()
      
      property = updatedProperty
      error = updateError
      
      if (error) {
        console.error('❌ Error updating property:', error)
        throw error
      }
      
      console.log('✅ Successfully updated existing property in database:', property.id)
    } else {
      // Insert new property
      console.log(`➕ Creating new property in database...`)
      const { data: newProperty, error: insertError } = await supabase
        .from('properties')
        .insert(finalData)
        .select()
        .single()
      
      property = newProperty
      error = insertError
      
      if (error) {
        console.error('❌ Error inserting property:', error)
        throw error
      }
      
      console.log('✅ Successfully added new property to database:', property.id)
    }

    console.log('🎉 Property sync completed successfully!')
    console.log('📊 Property details:')
    console.log(`   - Local ID: ${property.id}`)
    console.log(`   - Buildium ID: ${property.buildium_property_id}`)
    console.log(`   - Name: ${property.name}`)
    console.log(`   - Address: ${property.address_line1}, ${property.city}, ${property.state}`)
    console.log(`   - Status: ${property.is_active ? 'Active' : 'Inactive'}`)
    console.log(`   - Operating Bank Account ID: ${property.operating_bank_account_id || 'Not set'}`)

    return property

  } catch (error) {
    console.error('❌ Failed to fetch and add property:', error)
    throw error
  }
}

// Run the script
if (require.main === module) {
  const args = process.argv.slice(2)
  const propertyId = args[0] ? parseInt(args[0]) : undefined
  
  if (!propertyId || isNaN(propertyId)) {
    console.error('❌ Invalid property ID. Please provide a valid number.')
    console.log('Usage: npm run script scripts/buildium/create/fetch-and-add-buildium-property.ts <propertyId>')
    process.exit(1)
  }
  
  fetchAndAddBuildiumProperty(propertyId)
    .then(() => {
      console.log('🎯 Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Script failed:', error)
      process.exit(1)
    })
}

export { fetchAndAddBuildiumProperty }
