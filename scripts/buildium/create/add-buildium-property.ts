import { createClient } from '@supabase/supabase-js'
import { mapPropertyToDB, type CountryEnum, type StatusEnum } from '@/types/properties'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addBuildiumProperty() {
  try {
    console.log('Adding/updating Buildium property 7647 in Supabase database...')

    // Check if property already exists
    const { data: existingProperties, error: checkError } = await supabase
      .from('properties')
      .select('*')
      .eq('buildium_property_id', 7647)

    if (checkError) {
      console.error('Error checking existing property:', checkError)
      throw checkError
    }

    if (existingProperties && existingProperties.length > 0) {
      console.log(`Found ${existingProperties.length} existing properties with buildium_property_id 7647`)
      console.log('Updating the first existing property with correct Buildium data...')
      
      const existingProperty = existingProperties[0]
      console.log('Existing property ID:', existingProperty.id)
    }

    // Property data from Buildium API response
    const buildiumProperty = {
      id: 7647,
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
    const dbData = mapPropertyToDB(propertyData)

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
  addBuildiumProperty()
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
