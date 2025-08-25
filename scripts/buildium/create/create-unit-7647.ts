import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { logger } from './utils/logger'

// Load environment variables
config()

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const propertyId = '7647'

interface BuildiumUnit {
  Id: number
  PropertyId: number
  BuildingName: string
  UnitNumber: string
  Description: string
  MarketRent: number
  Address: {
    AddressLine1: string
    AddressLine2: string
    AddressLine3: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
  UnitBedrooms: string
  UnitBathrooms: string
  UnitSize: number
  IsUnitListed: boolean
  IsUnitOccupied: boolean
}

async function fetchUnitsFromBuildium(propertyId: string): Promise<BuildiumUnit[]> {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/units?propertyId=${propertyId}`
  
  try {
    const response = await fetch(buildiumUrl, {
      headers: {
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    logger.info(`Successfully fetched ${data.length} units from Buildium for property ${propertyId}`)
    return data
  } catch (error) {
    logger.error('Error fetching units from Buildium:', error)
    throw error
  }
}

async function getLocalPropertyId(buildiumPropertyId: string): Promise<string> {
  const { data: property, error } = await supabase
    .from('properties')
    .select('id')
    .eq('buildium_property_id', buildiumPropertyId)
    .single()

  if (error) {
    logger.error('Error finding local property:', error)
    throw error
  }

  if (!property) {
    throw new Error(`No local property found for Buildium property ID ${buildiumPropertyId}`)
  }

  return property.id
}

async function createUnitRecord(buildiumUnit: BuildiumUnit, localPropertyId: string) {
  try {
    // Map Buildium bathroom values to enum values
    const mapBathrooms = (buildiumBathrooms: string): string | null => {
      if (!buildiumBathrooms) return null
      switch (buildiumBathrooms) {
        case 'OneBath': return '1'
        case 'OnePointFiveBath': return '1.5'
        case 'TwoBath': return '2'
        case 'TwoPointFiveBath': return '2.5'
        case 'ThreeBath': return '3'
        case 'ThreePointFiveBath': return '3.5'
        case 'FourBath': return '4+'
        case 'FiveBath': return '4+'
        case 'FivePlusBath': return '4+'
        default: return null
      }
    }

    // Map Buildium unit to local format
    const unitData = {
      property_id: localPropertyId,
      unit_number: buildiumUnit.UnitNumber,
      unit_type: buildiumUnit.BuildingName.includes('Single family') ? 'SingleFamily' : 'Apartment',
      unit_size: buildiumUnit.UnitSize,
      unit_bedrooms: buildiumUnit.UnitBedrooms,
      unit_bathrooms: mapBathrooms(buildiumUnit.UnitBathrooms),
      address_line1: buildiumUnit.Address.AddressLine1,
      address_line2: buildiumUnit.Address.AddressLine2 || null,
      address_line3: buildiumUnit.Address.AddressLine3 || null,
      city: buildiumUnit.Address.City,
      state: buildiumUnit.Address.State,
      postal_code: buildiumUnit.Address.PostalCode,
      country: buildiumUnit.Address.Country,
      buildium_unit_id: buildiumUnit.Id,
      buildium_property_id: buildiumUnit.PropertyId,
      is_active: true,
      buildium_created_at: new Date().toISOString(),
      buildium_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    logger.info('Creating unit with data:', {
      unitNumber: unitData.unit_number,
      unitType: unitData.unit_type,
      buildiumUnitId: unitData.buildium_unit_id
    })
    console.log('Full unit data:', JSON.stringify(unitData, null, 2))

    // Insert into database
    const { data: createdUnit, error } = await supabase
      .from('units')
      .insert(unitData)
      .select()
      .single()

    if (error) {
      console.error('Error creating unit:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      throw error
    }

    logger.info('Successfully created unit:', {
      id: createdUnit.id,
      unitNumber: createdUnit.unit_number,
      unitType: createdUnit.unit_type
    })

    return createdUnit
  } catch (error) {
    logger.error('Unit creation failed:', error)
    throw error
  }
}

async function main() {
  try {
    logger.info('Fetching units from Buildium for property 7647...')
    const units = await fetchUnitsFromBuildium(propertyId)
    
    // Filter for units that belong to property 7647
    const property7647Units = units.filter(unit => unit.PropertyId.toString() === propertyId)
    
    logger.info(`Found ${property7647Units.length} units for property 7647:`)
    property7647Units.forEach((unit, index) => {
      logger.info(`Unit ${index + 1}:`, {
        id: unit.Id,
        propertyId: unit.PropertyId,
        unitNumber: unit.UnitNumber,
        buildingName: unit.BuildingName,
        unitBedrooms: unit.UnitBedrooms,
        unitBathrooms: unit.UnitBathrooms,
        unitSize: unit.UnitSize
      })
    })
    
    if (property7647Units.length === 0) {
      logger.info('No units found for property 7647')
      return
    }
    
    // Get local property ID
    const localPropertyId = await getLocalPropertyId(propertyId)
    logger.info(`Found local property ID: ${localPropertyId}`)
    
    // Create unit records
    for (const unit of property7647Units) {
      try {
        await createUnitRecord(unit, localPropertyId)
      } catch (error) {
        logger.error(`Failed to create unit ${unit.Id}:`, error)
        // Continue with other units
      }
    }
    
    logger.info('Unit creation completed')
    
  } catch (error) {
    logger.error('Failed to process units:', error)
    process.exit(1)
  }
}

main()
