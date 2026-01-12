import { createClient } from '@supabase/supabase-js'
import type { CountryEnum, StatusEnum } from '@/types/properties'
import * as dotenv from 'dotenv'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

// Load environment variables
dotenv.config({ path: '.env' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addBuildiumProperty(propertyId?: number) {
  try {
    // Use provided property ID or default to a placeholder
    const targetPropertyId = propertyId || 0
    console.log(`Adding/updating Buildium property ${targetPropertyId} in Supabase database...`)

    // Check if property already exists
    const { data: existingProperties, error: checkError } = await supabase
      .from('properties')
      .select('*')
      .eq('buildium_property_id', targetPropertyId)

    if (checkError) {
      console.error('Error checking existing property:', checkError)
      throw checkError
    }

    if (existingProperties && existingProperties.length > 0) {
      console.log(`Found ${existingProperties.length} existing properties with buildium_property_id ${targetPropertyId}`)
      console.log('Updating the first existing property with correct Buildium data...')
      
      const existingProperty = existingProperties[0]
      console.log('Existing property ID:', existingProperty.id)
    }

    // Property data from Buildium API response (placeholder - should be fetched from API)
    const buildiumProperty = {
      id: targetPropertyId,
      name: "325 Lexington | Brandon Babel",
      structureDescription: "",
      numberUnits: 1,
      isActive: true,
      operatingBankAccountId: 10407,
      reserve: 0.00,
      address: {
        addressLine1: "325 Lexington Ave",
        addressLine2: "",
        addressLine3: "",
        city: "New York",
        state: "NY",
        postalCode: "10016",
        country: "UnitedStates"
      },
      yearBuilt: null,
      rentalType: "Residential",
      rentalSubType: "SingleFamily",
      rentalManager: null
    }

    // Map to our database schema
    const propertyData = {
      name: buildiumProperty.name,
      structureDescription: buildiumProperty.structureDescription || undefined,
      addressLine1: buildiumProperty.address.addressLine1,
      addressLine2: buildiumProperty.address.addressLine2 || undefined,
      addressLine3: buildiumProperty.address.addressLine3 || undefined,
      city: buildiumProperty.address.city,
      state: buildiumProperty.address.state,
      postalCode: buildiumProperty.address.postalCode,
      country: buildiumProperty.address.country as CountryEnum,
      buildiumPropertyId: buildiumProperty.id,
      rentalSubType: buildiumProperty.rentalSubType as any,
      operatingBankAccountId: undefined,
      reserve: buildiumProperty.reserve,
      yearBuilt: buildiumProperty.yearBuilt,
      status: (buildiumProperty.isActive ? 'Active' : 'Inactive') as StatusEnum,
    totalUnits: buildiumProperty.numberUnits
  }

  // Map to database format
  const dbData = {
    name: propertyData.name,
    structure_description: propertyData.structureDescription ?? null,
    address_line1: propertyData.addressLine1,
    address_line2: propertyData.addressLine2 ?? null,
    address_line3: propertyData.addressLine3 ?? null,
    city: propertyData.city ?? null,
    state: propertyData.state ?? null,
    postal_code: propertyData.postalCode,
    country: propertyData.country,
    buildium_property_id: propertyData.buildiumPropertyId,
    rental_sub_type: propertyData.rentalSubType,
    operating_bank_account_id: propertyData.operatingBankAccountId,
    reserve: propertyData.reserve,
    year_built: propertyData.yearBuilt ?? null,
    status: propertyData.status,
    total_units: propertyData.totalUnits
  }

    // Add required timestamp fields
    const now = new Date().toISOString()
    const finalDbData = {
      ...dbData,
      created_at: now,
      updated_at: now
    }

    console.log('Final data for database:', finalDbData)

    let property
    let error

    if (existingProperties && existingProperties.length > 0) {
      // Update existing property
      const { data: updatedProperty, error: updateError } = await supabase
        .from('properties')
        .update(finalDbData)
        .eq('id', existingProperties[0].id)
        .select()
        .single()
      
      property = updatedProperty
      error = updateError
      
      if (error) {
        console.error('Error updating property:', error)
        throw error
      }
      
      console.log('✅ Successfully updated existing property in database:', property)
    } else {
      // Insert new property
      const { data: newProperty, error: insertError } = await supabase
        .from('properties')
        .insert(finalDbData)
        .select()
        .single()
      
      property = newProperty
      error = insertError
      
      if (error) {
        console.error('Error inserting property:', error)
        throw error
      }
      
      console.log('✅ Successfully added new property to database:', property)
    }

    return property

  } catch (error) {
    console.error('❌ Failed to add property:', error)
    throw error
  }
}

// Run the script
if (require.main === module) {
  const args = process.argv.slice(2)
  const propertyId = args[0] ? parseInt(args[0]) : undefined
  
  if (propertyId && isNaN(propertyId)) {
    console.error('❌ Invalid property ID. Please provide a valid number.')
    process.exit(1)
  }
  
  ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
    .then(() => addBuildiumProperty(propertyId))
    .then(() => {
      console.log('Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Script failed:', error)
      process.exit(1)
    })
}

export { addBuildiumProperty }
