import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function debugUnitIdMatching() {
  try {
    console.log('🔍 Debugging Unit ID Matching...\n')

    // Get the lease we know exists
    const { data: lease, error: leaseError } = await supabase
      .from('lease')
      .select('id, unit_id')
      .eq('id', 16)
      .single()

    if (leaseError) {
      console.error('❌ Error fetching lease:', leaseError)
      return
    }

    const leaseUnitId = lease.unit_id
    console.log(`📋 Lease unit_id: "${leaseUnitId}"`)
    console.log(`📋 Lease unit_id length: ${leaseUnitId.length}`)
    console.log(`📋 Lease unit_id type: ${typeof leaseUnitId}`)
    console.log(`📋 Lease unit_id bytes: ${Buffer.from(leaseUnitId).toString('hex')}`)

    // Try different query approaches
    console.log(`\n🔍 Testing different query approaches:`)

    // Approach 1: Direct equality
    const { data: result1 } = await supabase
      .from('lease')
      .select('id, unit_id')
      .eq('unit_id', leaseUnitId)
    console.log(`  Approach 1 (eq): Found ${result1?.length || 0} leases`)

    // Approach 2: Text search
    const { data: result2 } = await supabase
      .from('lease')
      .select('id, unit_id')
      .textSearch('unit_id', leaseUnitId)
    console.log(`  Approach 2 (textSearch): Found ${result2?.length || 0} leases`)

    // Approach 3: Like search
    const { data: result3 } = await supabase
      .from('lease')
      .select('id, unit_id')
      .like('unit_id', `%${leaseUnitId}%`)
    console.log(`  Approach 3 (like): Found ${result3?.length || 0} leases`)

    // Approach 4: Get all leases and filter manually
    const { data: allLeases } = await supabase
      .from('lease')
      .select('id, unit_id')
    console.log(`  Approach 4 (all leases): Found ${allLeases?.length || 0} total leases`)
    
    if (allLeases && allLeases.length > 0) {
      const matchingLeases = allLeases.filter(l => l.unit_id === leaseUnitId)
      console.log(`    Manual filter: Found ${matchingLeases.length} matching leases`)
      
      allLeases.forEach(l => {
        const isMatch = l.unit_id === leaseUnitId
        console.log(`    - ID: ${l.id}, Unit ID: "${l.unit_id}", Match: ${isMatch}`)
        if (isMatch) {
          console.log(`      -> Unit ID length: ${l.unit_id.length}, bytes: ${Buffer.from(l.unit_id).toString('hex')}`)
        }
      })
    }

    // Check if there are any units with similar IDs
    console.log(`\n🔍 Checking for similar unit IDs:`)
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('id, unit_number, unit_name')
      .limit(10)
    
    if (unitsError) {
      console.error('❌ Error fetching units:', unitsError)
    } else {
      console.log(`📋 Found ${units?.length || 0} units:`)
      units?.forEach(u => {
        const isMatch = u.id === leaseUnitId
        console.log(`  - ID: "${u.id}", Unit: ${u.unit_number} (${u.unit_name}), Match: ${isMatch}`)
        if (isMatch) {
          console.log(`    -> Unit ID length: ${u.id.length}, bytes: ${Buffer.from(u.id).toString('hex')}`)
        }
      })
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

debugUnitIdMatching()
