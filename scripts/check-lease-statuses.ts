import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLeaseStatuses() {
  try {
    console.log('🔍 Checking Lease Statuses...\n')

    // Get all leases with their statuses
    const { data: leases, error: leaseError } = await supabase
      .from('lease')
      .select('id, unit_id, status, rent_amount, lease_from_date, lease_to_date')
      .limit(20)

    if (leaseError) {
      console.error('❌ Error fetching leases:', leaseError)
      return
    }

    console.log(`📋 Found ${leases?.length || 0} total leases:`)
    
    if (leases && leases.length > 0) {
      // Group by status
      const statusCounts: Record<string, number> = {}
      leases.forEach(lease => {
        const status = lease.status || 'NULL'
        statusCounts[status] = (statusCounts[status] || 0) + 1
      })

      console.log('\n📊 Status Distribution:')
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count}`)
      })

      console.log('\n📋 Sample leases:')
      leases.slice(0, 10).forEach(lease => {
        console.log(`  - ID: ${lease.id}, Status: "${lease.status}", Unit: ${lease.unit_id}, Rent: $${lease.rent_amount || 0}`)
      })

      // Check for leases with rent amount
      const leasesWithRent = leases.filter(l => l.rent_amount && l.rent_amount > 0)
      console.log(`\n💰 Leases with rent amount: ${leasesWithRent.length}`)
      
      if (leasesWithRent.length > 0) {
        console.log('Sample leases with rent:')
        leasesWithRent.slice(0, 5).forEach(lease => {
          console.log(`  - ID: ${lease.id}, Status: "${lease.status}", Rent: $${lease.rent_amount}`)
        })
      }
    } else {
      console.log('⚠️ No leases found in database')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

checkLeaseStatuses()
