import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkUnitFromImage() {
  try {
    console.log('🔍 Checking Unit from Image Description...\n')

    // From the image: "99 John Street - 5A" with "Buildium ID: 22219"
    const buildiumUnitId = 22219
    
    console.log(`🏠 Looking for unit with Buildium ID: ${buildiumUnitId}`)

    // Find unit by Buildium ID
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id, unit_number, unit_name, buildium_unit_id, property_id')
      .eq('buildium_unit_id', buildiumUnitId)
      .single()

    if (unitError) {
      console.error('❌ Error finding unit by Buildium ID:', unitError)
      
      // Let's check all units to see what's available
      const { data: allUnits, error: allUnitsError } = await supabase
        .from('units')
        .select('id, unit_number, unit_name, buildium_unit_id, property_id')
        .limit(10)
      
      if (allUnitsError) {
        console.error('❌ Error fetching all units:', allUnitsError)
      } else {
        console.log(`\n📋 All units in system:`)
        allUnits?.forEach(u => {
          console.log(`  - Unit: ${u.unit_number} (${u.unit_name}), Buildium ID: ${u.buildium_unit_id}, DB ID: ${u.id}`)
        })
      }
      return
    }

    console.log(`✅ Found unit:`)
    console.log(`  - Unit: ${unit.unit_number} (${unit.unit_name})`)
    console.log(`  - Buildium ID: ${unit.buildium_unit_id}`)
    console.log(`  - DB ID: ${unit.id}`)
    console.log(`  - Property ID: ${unit.property_id}`)

    // Now check for leases for this unit
    console.log(`\n🔍 Checking for leases for this unit...`)
    const { data: leases, error: leaseError } = await supabase
      .from('lease')
      .select('id, status, rent_amount, buildium_lease_id, unit_id')
      .eq('unit_id', unit.id)

    if (leaseError) {
      console.error('❌ Error fetching leases:', leaseError)
    } else {
      console.log(`📋 Found ${leases?.length || 0} leases for this unit:`)
      leases?.forEach(lease => {
        console.log(`  - Lease ID: ${lease.id}, Status: "${lease.status}", Rent: $${lease.rent_amount}, Buildium ID: ${lease.buildium_lease_id}`)
      })

      if (leases && leases.length > 0) {
        // Check for transaction lines for the active lease
        const activeLease = leases.find(l => l.status?.toLowerCase() === 'active') || leases[0]
        console.log(`\n🎯 Checking transactions for active lease ${activeLease.id}...`)
        
        const { data: transactions, error: txError } = await supabase
          .from('transaction_lines')
          .select('amount, posting_type, gl_account_id, gl_accounts(type, is_bank_account)')
          .eq('lease_id', activeLease.id)
        
        if (txError) {
          console.error('❌ Error fetching transactions:', txError)
        } else {
          console.log(`💰 Found ${transactions?.length || 0} transaction lines:`)
          
          let balance = 0
          transactions?.forEach(tx => {
            const amount = Number(tx.amount) || 0
            const isDebit = tx.posting_type === 'Debit'
            
            if (isDebit) {
              balance += amount
            } else {
              balance -= amount
            }
            
            console.log(`  - ${tx.posting_type} $${amount} -> Balance: $${balance.toFixed(2)}`)
          })
          
          console.log(`\n📊 Final Balance: $${balance.toFixed(2)}`)
          console.log(`📊 Final Rent: $${activeLease.rent_amount}`)
        }
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

checkUnitFromImage()
