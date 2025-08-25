import { config } from 'dotenv'
import { logger } from './utils/logger'

config()

const rentId = '7906'

async function fetchRentScheduleFromBuildium(rentId: string) {
  // Try different possible endpoints for rent schedules
  const endpoints = [
    `/rentals/leases/16235/rent/${rentId}`,
    `/leases/16235/rent/${rentId}`
  ]
  
  for (const endpoint of endpoints) {
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}${endpoint}`
    console.log(`\nTrying endpoint: ${endpoint}`)
    
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
        console.log('Rent schedule data from Buildium:', JSON.stringify(data, null, 2))
        logger.info(`Successfully fetched rent schedule ${rentId} from Buildium`)
        return data
      } else {
        const errorText = await response.text()
        console.log(`❌ Failed with endpoint: ${endpoint} - ${response.status} ${response.statusText}`)
        if (response.status !== 404) {
          console.log('Error response:', errorText)
        }
      }
    } catch (error) {
      console.log(`❌ Error with endpoint: ${endpoint} - ${error}`)
    }
  }
  
  throw new Error('All rent schedule endpoints failed')
}

async function main() {
  try {
    logger.info(`Fetching rent schedule ${rentId} from Buildium...`)
    const rentSchedule = await fetchRentScheduleFromBuildium(rentId)

    console.log('\nKey rent schedule fields:')
    console.log('ID:', rentSchedule.Id)
    console.log('Lease ID:', rentSchedule.LeaseId)
    console.log('Start Date:', rentSchedule.StartDate)
    console.log('End Date:', rentSchedule.EndDate)
    console.log('Total Amount:', rentSchedule.TotalAmount)
    console.log('Rent Cycle:', rentSchedule.RentCycle)
    console.log('Backdate Charges:', rentSchedule.BackdateCharges)

    // Check if there are any additional fields
    console.log('\nAll rent schedule fields:')
    Object.keys(rentSchedule).forEach(key => {
      console.log(`${key}:`, rentSchedule[key])
    })

  } catch (error) {
    logger.error('Failed to fetch rent schedule:', error)
    process.exit(1)
  }
}

main()
