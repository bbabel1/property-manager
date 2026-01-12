import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { logger } from '../../utils/logger'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const leaseId = '16235'
const rentId = '7906'

interface BuildiumRentSchedule {
  Id: number
  StartDate: string
  EndDate: string | null
  TotalAmount: number
  RentCycle: string
  BackdateCharges: boolean
  CreatedDateTime: string
  CreatedByUserId: number
  Charges: Array<{
    Id: number
    GLAccountId: number
    Amount: number
    Memo: string
    FirstChargeDate: string
    PostDaysInAdvance: number
    DueOnDayOfTheMonth: number
  }>
}

async function fetchRentScheduleFromBuildium(leaseId: string, rentId: string): Promise<BuildiumRentSchedule> {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/${leaseId}/rent/${rentId}`
  
  try {
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
      throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    logger.info(`Successfully fetched rent schedule ${rentId} from Buildium`)
    return data
  } catch (error) {
    logger.error('Error fetching rent schedule from Buildium')
    console.error('Error details:', error)
    throw error
  }
}

async function getLocalLeaseId(buildiumLeaseId: number): Promise<number> {
  const { data: lease, error } = await supabase
    .from('lease')
    .select('id')
    .eq('buildium_lease_id', buildiumLeaseId)
    .single()

  if (error) {
    throw new Error(`Error finding lease with Buildium ID ${buildiumLeaseId}: ${error.message}`)
  }

  return lease.id
}

async function createRentScheduleRecord(buildiumRentSchedule: BuildiumRentSchedule, localLeaseId: number): Promise<string> {
  try {
    const rentScheduleData = {
      lease_id: localLeaseId,
      buildium_rent_id: buildiumRentSchedule.Id,
      StartDate: buildiumRentSchedule.StartDate,
      EndDate: buildiumRentSchedule.EndDate,
      TotalAmount: buildiumRentSchedule.TotalAmount,
      RentCycle: buildiumRentSchedule.RentCycle,
      BackdateCharges: buildiumRentSchedule.BackdateCharges,
      updated_at: new Date().toISOString()
    }

    const { data: rentSchedule, error } = await supabase
      .from('rent_schedules')
      .insert(rentScheduleData)
      .select('id')
      .single()

    if (error) {
      console.error('Error creating rent schedule:', error)
      console.error('Attempted data:', rentScheduleData)
      throw error
    }

    logger.info(`Created rent schedule record with ID: ${rentSchedule.id}`)
    return rentSchedule.id
  } catch (error) {
    logger.error('Failed to create rent schedule record')
    console.error('Error details:', error)
    throw error
  }
}

async function main() {
  try {
    await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
    logger.info(`Fetching rent schedule ${rentId} for lease ${leaseId} from Buildium...`)
    const buildiumRentSchedule = await fetchRentScheduleFromBuildium(leaseId, rentId)
    
    logger.info('Getting local lease ID...')
    const localLeaseId = await getLocalLeaseId(parseInt(leaseId))
    
    logger.info('Creating rent schedule record...')
    const rentScheduleId = await createRentScheduleRecord(buildiumRentSchedule, localLeaseId)
    
    logger.info('Successfully created rent schedule record!')
    console.log('Rent Schedule ID:', rentScheduleId)
    console.log('Buildium Rent ID:', buildiumRentSchedule.Id)
    console.log('Lease ID:', localLeaseId)
    console.log('Total Amount:', buildiumRentSchedule.TotalAmount)
    console.log('Rent Cycle:', buildiumRentSchedule.RentCycle)
    console.log('Start Date:', buildiumRentSchedule.StartDate)
    console.log('End Date:', buildiumRentSchedule.EndDate)
    console.log('Backdate Charges:', buildiumRentSchedule.BackdateCharges)
    
    if (buildiumRentSchedule.Charges && buildiumRentSchedule.Charges.length > 0) {
      console.log('\nCharges:')
      buildiumRentSchedule.Charges.forEach((charge, index) => {
        console.log(`  Charge ${index + 1}:`)
        console.log('    ID:', charge.Id)
        console.log('    Amount:', charge.Amount)
        console.log('    Memo:', charge.Memo)
        console.log('    First Charge Date:', charge.FirstChargeDate)
        console.log('    Due Day:', charge.DueOnDayOfTheMonth)
      })
    }
    
  } catch (error) {
    logger.error('Failed to create rent schedule record')
    console.error('Error details:', error)
    process.exit(1)
  }
}

main()
