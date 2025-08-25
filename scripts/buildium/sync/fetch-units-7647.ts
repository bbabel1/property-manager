import { config } from 'dotenv'
import { logger } from './utils/logger'

// Load environment variables
config()

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

async function main() {
  try {
    logger.info('Fetching units from Buildium for property 7647...')
    const units = await fetchUnitsFromBuildium(propertyId)
    
    console.log(`Found ${units.length} units:`)
    units.forEach((unit, index) => {
      console.log(`Unit ${index + 1}:`, {
        id: unit.Id,
        propertyId: unit.PropertyId,
        unitType: unit.UnitType,
        number: unit.Number,
        squareFootage: unit.SquareFootage,
        bedrooms: unit.Bedrooms,
        bathrooms: unit.Bathrooms,
        isActive: unit.IsActive,
        createdDate: unit.CreatedDate,
        modifiedDate: unit.ModifiedDate
      })
    })
    
    // Show first unit in detail
    if (units.length > 0) {
      console.log('First unit detailed data:', JSON.stringify(units[0], null, 2))
    }
    
  } catch (error) {
    logger.error('Failed to fetch units:', error)
    process.exit(1)
  }
}

main()
