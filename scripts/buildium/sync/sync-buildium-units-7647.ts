import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mapUnitFromBuildium } from '@/lib/buildium-mappers'
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
  UnitType: string
  Number: string
  SquareFootage?: number
  Bedrooms?: number
  Bathrooms?: number
  IsActive: boolean
  CreatedDate: string
  ModifiedDate: string
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

async function syncUnitFromBuildium(buildiumUnit: BuildiumUnit, localPropertyId: string) {
  try {
    // 1. Map from Buildium format to local format
    const localUnit = mapUnitFromBuildium(buildiumUnit)
    logger.info('Mapped unit data:', {
      unitNumber: localUnit.unit_number,
      unitType: localUnit.unit_type,
      buildiumUnitId: localUnit.buildium_unit_id
    })

    // 2. Prepare database data
    const dbData = {
      property_id: localPropertyId,
      unit_number: localUnit.unit_number,
      unit_type: localUnit.unit_type,
      unit_size: localUnit.square_footage,
      unit_bedrooms: localUnit.bedrooms?.toString(),
      unit_bathrooms: localUnit.bathrooms?.toString(),
      address_line1: localUnit.address_line1 || '325 Lexington Ave', // Default to property address
      address_line2: localUnit.address_line2,
      address_line3: localUnit.address_line3,
      city: localUnit.city || 'New York',
      state: localUnit.state || 'NY',
      postal_code: localUnit.postal_code || '10016',
      country: localUnit.country || 'UnitedStates',
      buildium_unit_id: localUnit.buildium_unit_id,
      buildium_property_id: localUnit.buildium_property_id,
      is_active: localUnit.is_active,
      buildium_created_at: localUnit.buildium_created_at,
      buildium_updated_at: localUnit.buildium_updated_at,
      updated_at: new Date().toISOString()
    }

    logger.info('Database data to insert:', {
      unitNumber: dbData.unit_number,
      unitType: dbData.unit_type,
      buildiumUnitId: dbData.buildium_unit_id
    })

    // 3. Upsert to database
    logger.info('Attempting to upsert unit with data:', JSON.stringify(dbData, null, 2))
    
    const { data: upsertedUnit, error } = await supabase
      .from('units')
      .upsert(dbData, {
        onConflict: 'buildium_unit_id',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (error) {
      logger.error('Error upserting unit:', error)
      logger.error('Error details:', JSON.stringify(error, null, 2))
      logger.error('Attempted data:', JSON.stringify(dbData, null, 2))
      throw error
    }

    logger.info('Successfully synced unit:', {
      id: upsertedUnit.id,
      unitNumber: upsertedUnit.unit_number,
      unitType: upsertedUnit.unit_type
    })

    return upsertedUnit
  } catch (error) {
    logger.error('Unit sync failed:', error)
    throw error
  }
}

async function syncUnitsFromBuildium(propertyId: string) {
  try {
    logger.info(`Starting unit sync for property ${propertyId}...`)

    // 1. Fetch units from Buildium
    const buildiumUnits = await fetchUnitsFromBuildium(propertyId)
    
    if (buildiumUnits.length === 0) {
      logger.info(`No units found for property ${propertyId}`)
      return []
    }

    // 2. Get local property ID
    const localPropertyId = await getLocalPropertyId(propertyId)
    logger.info(`Found local property ID: ${localPropertyId}`)

    // 3. Sync each unit
    const syncedUnits = []
    for (const buildiumUnit of buildiumUnits) {
      try {
        const syncedUnit = await syncUnitFromBuildium(buildiumUnit, localPropertyId)
        syncedUnits.push(syncedUnit)
      } catch (error) {
        logger.error(`Failed to sync unit ${buildiumUnit.Id}:`, error)
        // Continue with other units
      }
    }

    logger.info(`Successfully synced ${syncedUnits.length} out of ${buildiumUnits.length} units`)
    return syncedUnits
  } catch (error) {
    logger.error('Unit sync failed:', error)
    throw error
  }
}

async function main() {
  try {
    logger.info('Starting Buildium units sync for property 7647...')
    const result = await syncUnitsFromBuildium(propertyId)
    logger.info('Units sync completed successfully:', result)
  } catch (error) {
    logger.error('Units sync failed:', error)
    process.exit(1)
  }
}

main()
