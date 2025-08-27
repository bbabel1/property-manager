import { createClient } from '@supabase/supabase-js'
import { mapUnitFromBuildium } from '@/lib/buildium-mappers'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Helper function to get property ID by Buildium property ID
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

// Helper function to map Buildium bedroom values to database enum values
function mapBedrooms(bedroomStr: string): string | null {
  switch (bedroomStr) {
    case 'NotSet': return null
    case 'Studio': return 'Studio'
    case 'OneBed': return '1'
    case 'TwoBed': return '2'
    case 'ThreeBed': return '3'
    case 'FourBed': return '4'
    case 'FiveBed': return '5'
    case 'SixBed': return '6'
    case 'SevenBed': return '7'
    case 'EightBed': return '8'
    case 'NineBedPlus': return '9+'
    default: return null
  }
}

// Helper function to map Buildium bathroom values to database enum values
function mapBathrooms(bathroomStr: string): string | null {
  switch (bathroomStr) {
    case 'NotSet': return null
    case 'OneBath': return '1'
    case 'OnePointFiveBath': return '1.5'
    case 'TwoBath': return '2'
    case 'TwoPointFiveBath': return '2.5'
    case 'ThreeBath': return '3'
    case 'ThreePointFiveBath': return '3.5'
    case 'FourBath': return '4'
    case 'FourPointFiveBath': return '4.5'
    case 'FiveBath': return '5'
    case 'FivePlusBath': return '5+'
    default: return null
  }
}

// Helper function to map Buildium unit data to our database format
function mapBuildiumUnitToLocal(buildiumUnit: any) {
  return {
    unit_number: buildiumUnit.UnitNumber || buildiumUnit.Number || '',
    unit_type: 'Apartment', // Default to apartment
    square_footage: buildiumUnit.UnitSize || buildiumUnit.SquareFootage || null,
    unit_bedrooms: mapBedrooms(buildiumUnit.UnitBedrooms),
    unit_bathrooms: mapBathrooms(buildiumUnit.UnitBathrooms),
    is_active: buildiumUnit.IsUnitListed !== false, // Default to true if not specified
    buildium_unit_id: buildiumUnit.Id,
    buildium_created_at: buildiumUnit.CreatedDate || null,
    buildium_updated_at: buildiumUnit.ModifiedDate || null,
    // Address fields
    address_line1: buildiumUnit.Address?.AddressLine1 || '',
    address_line2: buildiumUnit.Address?.AddressLine2 || null,
    address_line3: buildiumUnit.Address?.AddressLine3 || null,
    city: buildiumUnit.Address?.City || '',
    state: buildiumUnit.Address?.State || '',
    postal_code: buildiumUnit.Address?.PostalCode || '',
    country: buildiumUnit.Address?.Country || 'UnitedStates',
    // Description
    description: buildiumUnit.Description || null,
    // Market rent
    market_rent: buildiumUnit.MarketRent || null
  }
}

async function fetchBuildiumUnits(propertyId: number) {
  // Use the correct endpoint with propertyids query parameter
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units?propertyids=${propertyId}`
  
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
    console.log('Units data from Buildium:', JSON.stringify(data, null, 2))
    return data
  } catch (error) {
    console.error('Error fetching units from Buildium:', error)
    throw error
  }
}

async function fetchAndAddBuildiumUnits(propertyId: number) {
  try {
    console.log(`🔍 Fetching Buildium units for property ${propertyId}...`)

    // Get the local property ID
    const localPropertyId = await getPropertyByBuildiumId(propertyId)
    if (!localPropertyId) {
      throw new Error(`Property with Buildium ID ${propertyId} not found in local database`)
    }

    // Fetch units from Buildium using the correct endpoint with propertyids filter
    const buildiumUnitsResponse = await fetchBuildiumUnits(propertyId)
    const buildiumUnits = buildiumUnitsResponse.Value || buildiumUnitsResponse // Handle different response formats
    
    if (!Array.isArray(buildiumUnits)) {
      console.log('No units found or invalid response format')
      return []
    }

    console.log(`✅ Successfully fetched ${buildiumUnits.length} units from Buildium for property ${propertyId}`)

    const results = []

    for (const buildiumUnit of buildiumUnits) {
      try {
        console.log(`\n🏠 Processing unit: ${buildiumUnit.UnitNumber || buildiumUnit.Number} (Buildium ID: ${buildiumUnit.Id})`)

        // Check if unit already exists in database
        const { data: existingUnits, error: checkError } = await supabase
          .from('units')
          .select('*')
          .eq('buildium_unit_id', buildiumUnit.Id)

        if (checkError) {
          console.error('❌ Error checking existing unit:', checkError)
          throw checkError
        }

        // Map Buildium data to our database format using our custom mapper
        const localData = mapBuildiumUnitToLocal(buildiumUnit)
        
        // Add the property_id
        localData.property_id = localPropertyId
        
        // Add required timestamp fields
        const now = new Date().toISOString()
        const finalData = {
          ...localData,
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

        results.push({
          success: true,
          unit: {
            id: unit.id,
            unit_number: unit.unit_number,
            buildium_unit_id: unit.buildium_unit_id,
            property_id: unit.property_id
          }
        })

      } catch (error) {
        console.error(`❌ Failed to process unit ${buildiumUnit.UnitNumber || buildiumUnit.Number}:`, error)
        results.push({
          success: false,
          unit: buildiumUnit,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    console.log('\n🎉 Units sync completed!')
    console.log('📊 Summary:')
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    console.log(`   - Total units processed: ${results.length}`)
    console.log(`   - Successfully synced: ${successful}`)
    console.log(`   - Failed: ${failed}`)

    if (successful > 0) {
      console.log('\n✅ Successfully synced units:')
      results.filter(r => r.success).forEach(result => {
        console.log(`   - ${result.unit.unit_number} (ID: ${result.unit.id})`)
      })
    }

    if (failed > 0) {
      console.log('\n❌ Failed units:')
      results.filter(r => !r.success).forEach(result => {
        console.log(`   - ${result.unit.UnitNumber || result.unit.Number} (Buildium ID: ${result.unit.Id}): ${result.error}`)
      })
    }

    return results

  } catch (error) {
    console.error('❌ Failed to fetch and add units:', error)
    throw error
  }
}

// Run the script
if (require.main === module) {
  const args = process.argv.slice(2)
  const propertyId = args[0] ? parseInt(args[0]) : undefined
  
  if (!propertyId || isNaN(propertyId)) {
    console.error('❌ Invalid property ID. Please provide a valid number.')
    console.log('Usage: npx tsx scripts/buildium/create/fetch-and-add-buildium-units.ts <propertyId>')
    process.exit(1)
  }
  
  fetchAndAddBuildiumUnits(propertyId)
    .then(() => {
      console.log('\n🎯 Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Script failed:', error)
      process.exit(1)
    })
}

export { fetchAndAddBuildiumUnits }
