import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugLeaseTable() {
  try {
    console.log('🔍 Debugging Lease Table Structure...\n')

    // Get the lease we know exists
    const { data: lease, error: leaseError } = await supabase
      .from('lease')
      .select('*')
      .eq('id', 16)
      .single()

    if (leaseError) {
      console.error('❌ Error fetching lease:', leaseError)
      return
    }

    console.log('📋 Lease Record (ID 16):')
    Object.entries(lease).forEach(([key, value]) => {
      console.log(`  - ${key}: ${value} (${typeof value})`)
    })

    console.log(`\n🔍 Lease unit_id: "${lease.unit_id}"`)

    // Try to find leases by this unit_id
    console.log(`\n🔍 Searching for leases with unit_id = "${lease.unit_id}"`)
    const { data: leasesByUnit, error: unitError } = await supabase
      .from('lease')
      .select('id, unit_id, status, rent_amount')
      .eq('unit_id', lease.unit_id)

    if (unitError) {
      console.error('❌ Error searching by unit_id:', unitError)
    } else {
      console.log(`📋 Found ${leasesByUnit?.length || 0} leases with unit_id "${lease.unit_id}"`)
      leasesByUnit?.forEach(l => {
        console.log(`  - ID: ${l.id}, Status: "${l.status}", Rent: $${l.rent_amount}`)
      })
    }

    // Check if the unit exists
    console.log(`\n🔍 Checking if unit "${lease.unit_id}" exists`)
    const { data: unit, error: unitExistsError } = await supabase
      .from('units')
      .select('id, unit_number, unit_name')
      .eq('id', lease.unit_id)
      .single()

    if (unitExistsError) {
      console.error('❌ Unit does not exist:', unitExistsError)
    } else {
      console.log(`✅ Unit exists: ${unit.unit_number} (${unit.unit_name})`)
    }

    // Check all leases to see the unit_id pattern
    console.log(`\n🔍 All leases in the system:`)
    const { data: allLeases, error: allLeasesError } = await supabase
      .from('lease')
      .select('id, unit_id, status, rent_amount')
      .limit(10)

    if (allLeasesError) {
      console.error('❌ Error fetching all leases:', allLeasesError)
    } else {
      console.log(`📋 Found ${allLeases?.length || 0} total leases:`)
      allLeases?.forEach(l => {
        console.log(`  - ID: ${l.id}, Unit ID: "${l.unit_id}", Status: "${l.status}", Rent: $${l.rent_amount}`)
      })
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

debugLeaseTable()
