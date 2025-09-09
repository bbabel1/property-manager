import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

// Initialize Supabase client - use local instance for development
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function updateOwnerTotalFields(ownerId: string) {
  try {
    console.log(`🔄 Updating total fields for owner: ${ownerId}`)
    
    // Call the database function to update total fields
    const { data, error } = await supabase.rpc('update_owner_total_fields', {
      owner_uuid: ownerId
    })

    if (error) {
      console.error('❌ Error updating owner total fields:', error)
      throw error
    }

    console.log('✅ Successfully updated owner total fields')
    
    // Verify the update by fetching the ownership record
    const { data: ownership, error: fetchError } = await supabase
      .from('ownerships')
      .select('*')
      .eq('owner_id', ownerId)
      .single()

    if (fetchError) {
      console.error('❌ Error fetching ownership record:', fetchError)
      throw fetchError
    }

    console.log('📊 Updated ownership totals:')
    console.log(`   - Total Units: ${ownership.total_units}`)
    console.log(`   - Total Properties: ${ownership.total_properties}`)

    return ownership

  } catch (error) {
    console.error('❌ Failed to update owner total fields:', error)
    throw error
  }
}

async function updateAllOwnersTotalFields() {
  try {
    console.log('🔄 Updating total fields for all owners...')
    
    // Call the database function to update all owners
    const { data, error } = await supabase.rpc('update_all_owners_total_fields')

    if (error) {
      console.error('❌ Error updating all owners total fields:', error)
      throw error
    }

    console.log('✅ Successfully updated all owners total fields')

  } catch (error) {
    console.error('❌ Failed to update all owners total fields:', error)
    throw error
  }
}

async function main() {
  try {
    console.log('🚀 Starting ownership totals update...')
    console.log('=' .repeat(60))
    
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required Supabase environment variables. Please check your .env.local file.')
    }

    // Update all owners (this will fix any missing totals)
    await updateAllOwnersTotalFields()
    
    console.log('\n' + '=' .repeat(60))
    console.log('🎯 Update completed successfully!')
    
  } catch (error) {
    console.error('\n💥 Update failed:', error)
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n🎯 Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error)
      process.exit(1)
    })
}

export { main as fixOwnershipTotals }
