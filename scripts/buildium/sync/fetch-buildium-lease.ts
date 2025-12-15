import { config } from 'dotenv'
import { logger } from '../../utils/logger'

config({ path: '.env.local' })

const leaseId = '16235'

async function fetchLeaseFromBuildium(leaseId: string) {
  // Use direct Buildium API call with correct authentication
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/${leaseId}`
  
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
    console.log('Lease data from Buildium:', JSON.stringify(data, null, 2))
    logger.info(`Successfully fetched lease ${leaseId} from Buildium`)
    return data
  } catch (error) {
    logger.error('Error fetching lease from Buildium')
    console.error('Error details:', error)
    throw error
  }
}

async function main() {
  try {
    logger.info(`Fetching lease ${leaseId} from Buildium...`)
    const lease = await fetchLeaseFromBuildium(leaseId)
    
    console.log('\nKey lease fields:')
    console.log('ID:', lease.Id)
    console.log('Property ID:', lease.PropertyId)
    console.log('Unit ID:', lease.UnitId)
    console.log('Start Date:', lease.StartDate)
    console.log('End Date:', lease.EndDate)
    console.log('Status:', lease.Status)
    console.log('Rent Amount:', lease.RentAmount)
    console.log('Security Deposit:', lease.SecurityDepositAmount)
    
    // Check if there are any additional fields that might contain tenant info
    console.log('\nAll lease fields:')
    Object.keys(lease).forEach(key => {
      console.log(`${key}:`, (lease as any)[key])
    })
    
  } catch (error) {
    logger.error('Failed to fetch lease')
    console.error('Error details:', error)
    process.exit(1)
  }
}

main()
