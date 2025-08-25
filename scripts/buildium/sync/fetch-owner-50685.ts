import { config } from 'dotenv'
import { logger } from './utils/logger'

// Load environment variables
config()

const ownerId = '50685'

interface BuildiumOwner {
  Id: number
  FirstName: string
  LastName: string
  PrimaryAddress: {
    AddressLine1: string
    AddressLine2?: string
    AddressLine3?: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
  AlternateAddress?: {
    AddressLine1: string
    AddressLine2?: string
    AddressLine3?: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
  Email?: string
  AlternateEmail?: string
  PhoneNumbers?: {
    Home?: string
    Work?: string
    Mobile?: string
    Fax?: string
  }
  DateOfBirth?: string
  TaxId?: string
  IsActive: boolean
  CreatedDate: string
  ModifiedDate: string
}

async function fetchOwnerFromBuildium(ownerId: string): Promise<BuildiumOwner> {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/owners/${ownerId}`
  
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
    logger.info(`Successfully fetched owner ${ownerId} from Buildium`)
    return data
  } catch (error) {
    logger.error('Error fetching owner from Buildium:', error)
    throw error
  }
}

async function main() {
  try {
    logger.info('Fetching owner 50685 from Buildium...')
    const owner = await fetchOwnerFromBuildium(ownerId)
    
    console.log('Owner data from Buildium:', JSON.stringify(owner, null, 2))
    
    // Show key fields
    console.log('\nKey owner fields:')
    console.log('ID:', owner.Id)
    console.log('Name:', `${owner.FirstName} ${owner.LastName}`)
    console.log('Email:', owner.Email)
    console.log('Primary Address:', owner.PrimaryAddress)
    console.log('Phone Numbers:', owner.PhoneNumbers)
    console.log('Tax ID:', owner.TaxId)
    console.log('Is Active:', owner.IsActive)
    console.log('Created Date:', owner.CreatedDate)
    console.log('Modified Date:', owner.ModifiedDate)
    
  } catch (error) {
    logger.error('Failed to fetch owner:', error)
    process.exit(1)
  }
}

main()
