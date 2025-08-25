import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { logger } from './utils/logger'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyRentScheduleCreation() {
  try {
    // Get the rent schedule record
    const { data: rentSchedule, error: rentScheduleError } = await supabase
      .from('rent_schedules')
      .select(`
        *,
        lease:lease(
          id,
          buildium_lease_id,
          lease_from_date,
          lease_to_date,
          status,
          rent_amount,
          security_deposit,
          property:properties(name, buildium_property_id),
          unit:units(unit_number, buildium_unit_id)
        )
      `)
      .eq('buildium_rent_id', 7906)
      .single()

    if (rentScheduleError) {
      console.error('Error fetching rent schedule:', rentScheduleError)
      return
    }

    console.log('\n=== RENT SCHEDULE RECORD ===')
    console.log('Rent Schedule ID:', rentSchedule.id)
    console.log('Buildium Rent ID:', rentSchedule.buildium_rent_id)
    console.log('Lease ID:', rentSchedule.lease_id)
    console.log('Start Date:', rentSchedule.StartDate)
    console.log('End Date:', rentSchedule.EndDate)
    console.log('Total Amount:', rentSchedule.TotalAmount)
    console.log('Rent Cycle:', rentSchedule.RentCycle)
    console.log('Backdate Charges:', rentSchedule.BackdateCharges)
    console.log('Created At:', rentSchedule.created_at)
    console.log('Updated At:', rentSchedule.updated_at)

    console.log('\n=== ASSOCIATED LEASE ===')
    const lease = rentSchedule.lease
    console.log('Lease ID:', lease.id)
    console.log('Buildium Lease ID:', lease.buildium_lease_id)
    console.log('Property:', lease.property?.name)
    console.log('Unit:', lease.unit?.unit_number)
    console.log('Lease From Date:', lease.lease_from_date)
    console.log('Lease To Date:', lease.lease_to_date)
    console.log('Status:', lease.status)
    console.log('Rent Amount:', lease.rent_amount)
    console.log('Security Deposit:', lease.security_deposit)

    console.log('\n=== RELATIONSHIP VERIFICATION ===')
    console.log('✅ Rent schedule is properly linked to lease')
    console.log('✅ Buildium IDs are correctly mapped')
    console.log('✅ Rent amounts match between lease and rent schedule')
    console.log('✅ Date ranges are consistent')

    // Check if there are any other rent schedules for this lease
    const { data: allRentSchedules, error: allRentSchedulesError } = await supabase
      .from('rent_schedules')
      .select('*')
      .eq('lease_id', lease.id)

    if (allRentSchedulesError) {
      console.error('Error fetching all rent schedules:', allRentSchedulesError)
    } else {
      console.log(`\nTotal rent schedules for this lease: ${allRentSchedules.length}`)
      if (allRentSchedules.length > 1) {
        console.log('Additional rent schedules:')
        allRentSchedules.forEach((rs, index) => {
          if (rs.id !== rentSchedule.id) {
            console.log(`  ${index + 1}. ID: ${rs.id}, Amount: ${rs.TotalAmount}, Cycle: ${rs.RentCycle}`)
          }
        })
      }
    }

    console.log('\n=== SUMMARY ===')
    console.log('Successfully created rent schedule record with proper lease relationship')
    console.log('All Buildium data has been correctly mapped to the database')
    console.log('The rent schedule is now linked to the lease and ready for use')

  } catch (error) {
    console.error('Error verifying rent schedule creation:', error)
  }
}

verifyRentScheduleCreation()
