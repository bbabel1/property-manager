import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProperties() {
  try {
    console.log('🔍 Checking properties table...')
    
    // Check if properties table exists and get count
    const { data: properties, error: countError } = await supabase
      .from('properties')
      .select('*', { count: 'exact' })
    
    if (countError) {
      console.error('❌ Error querying properties table:', countError)
      return
    }
    
    console.log(`📊 Total properties in database: ${properties?.length || 0}`)
    
    if (properties && properties.length > 0) {
      console.log('\n📋 Properties found:')
      properties.forEach((property, index) => {
        console.log(`${index + 1}. ${property.name} (ID: ${property.id})`)
        console.log(`   Address: ${property.address_line1}, ${property.city}, ${property.state}`)
        console.log(`   Buildium ID: ${property.buildium_property_id || 'N/A'}`)
        console.log(`   Status: ${property.status || 'N/A'}`)
        console.log('')
      })
    } else {
      console.log('⚠️  No properties found in the database')
    }
    
    // Check table structure
    console.log('\n🔍 Checking table structure...')
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'properties' })
    
    if (tableError) {
      console.log('ℹ️  Could not get table info (this is normal)')
    } else {
      console.log('Table info:', tableInfo)
    }
    
  } catch (error) {
    console.error('❌ Error checking properties:', error)
  }
}

checkProperties()
