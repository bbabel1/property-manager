import { config } from 'dotenv'
import { logger } from '../../utils/logger'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

config({ path: '.env.local' })

const rentId = '7906'

async function fetchRentScheduleFromBuildium(rentId: string) {
  // Confirmed working endpoint for rent schedules
  const endpoint = `/leases/16235/rent/${rentId}`
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}${endpoint}`
  console.log(`\nRequesting endpoint: ${endpoint}`)

  const response = await fetch(buildiumUrl, {
    headers: {
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      'x-buildium-egress-allowed': '1',
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed fetching rent schedule ${rentId} via ${endpoint} - ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  console.log('✅ Rent schedule data from Buildium:', JSON.stringify(data, null, 2))
  logger.info(`Successfully fetched rent schedule ${rentId} from Buildium`)
  return data
}

async function main() {
  try {
    await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
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
    logger.error({ error }, 'Failed to fetch rent schedule')
    process.exit(1)
  }
}

main()
