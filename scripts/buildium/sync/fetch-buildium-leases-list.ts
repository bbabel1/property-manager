import { config } from 'dotenv'
import { logger } from './utils/logger'

config()

async function fetchLeasesFromBuildium() {
  // Try different possible endpoints
  const endpoints = [
    '/rentals/leases',
    '/leases',
    '/rentals/leases?propertyId=7647',
    '/leases?propertyId=7647'
  ]
  
  for (const endpoint of endpoints) {
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}${endpoint}`
    console.log(`Trying endpoint: ${endpoint}`)
    
    try {
      const response = await fetch(buildiumUrl, {
        headers: {
          'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
          'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`✅ Success with endpoint: ${endpoint}`)
        console.log('Leases data from Buildium:', JSON.stringify(data, null, 2))
        logger.info(`Successfully fetched leases from Buildium using ${endpoint}`)
        return data
      } else {
        const errorText = await response.text()
        console.log(`❌ Failed with endpoint: ${endpoint} - ${response.status} ${response.statusText}`)
        console.log('Error response:', errorText)
      }
    } catch (error) {
      console.log(`❌ Error with endpoint: ${endpoint} - ${error}`)
    }
  }
  
  throw new Error('All lease endpoints failed')
}

async function main() {
  try {
    logger.info(`Fetching leases from Buildium...`)
    const leases = await fetchLeasesFromBuildium()
    
    console.log('\nAvailable leases:')
    if (Array.isArray(leases)) {
      leases.forEach((lease: any, index: number) => {
        console.log(`Lease ${index + 1}:`)
        console.log('  ID:', lease.Id)
        console.log('  Property ID:', lease.PropertyId)
        console.log('  Unit ID:', lease.UnitId)
        console.log('  Status:', lease.Status)
        console.log('  Start Date:', lease.StartDate)
        console.log('  End Date:', lease.EndDate)
        console.log('  Rent Amount:', lease.RentAmount)
        console.log('---')
      })
    } else {
      console.log('Leases response structure:', Object.keys(leases))
    }
    
  } catch (error) {
    logger.error('Failed to fetch leases')
    console.error('Error details:', error)
    process.exit(1)
  }
}

main()
