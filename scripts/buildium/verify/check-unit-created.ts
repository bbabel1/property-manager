import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkUnitCreated() {
  try {
    // Check for the unit we just created
    const { data: units, error } = await supabase
      .from('units')
      .select('*')
      .eq('buildium_unit_id', 20616)

    if (error) {
      console.error('Error fetching unit:', error)
      return
    }

    console.log(`Found ${units.length} units with buildium_unit_id 20616:`)
    units.forEach((unit, index) => {
      console.log(`Unit ${index + 1}:`, {
        id: unit.id,
        property_id: unit.property_id,
        unit_number: unit.unit_number,
        unit_type: unit.unit_type,
        unit_size: unit.unit_size,
        unit_bedrooms: unit.unit_bedrooms,
        unit_bathrooms: unit.unit_bathrooms,
        buildium_unit_id: unit.buildium_unit_id,
        buildium_property_id: unit.buildium_property_id,
        is_active: unit.is_active,
        created_at: unit.created_at,
        updated_at: unit.updated_at
      })
    })

    // Also check all units for property 7647
    const { data: propertyUnits, error: propertyError } = await supabase
      .from('units')
      .select('*')
      .eq('buildium_property_id', 7647)

    if (propertyError) {
      console.error('Error fetching property units:', propertyError)
      return
    }

    console.log(`\nFound ${propertyUnits.length} units for property 7647:`)
    propertyUnits.forEach((unit, index) => {
      console.log(`Property Unit ${index + 1}:`, {
        id: unit.id,
        unit_number: unit.unit_number,
        unit_type: unit.unit_type,
        buildium_unit_id: unit.buildium_unit_id
      })
    })

  } catch (error) {
    console.error('Error:', error)
  }
}

checkUnitCreated()
