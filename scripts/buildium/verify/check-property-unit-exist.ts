import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { logger } from './utils/logger'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkPropertyAndUnit() {
  try {
    // Check property
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('buildium_property_id', 7647)
      .single()

    if (propertyError) {
      console.error('Property error:', propertyError)
    } else {
      console.log('Property found:', property)
    }

    // Check unit
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('*')
      .eq('buildium_unit_id', 20616)
      .single()

    if (unitError) {
      console.error('Unit error:', unitError)
    } else {
      console.log('Unit found:', unit)
    }

  } catch (error) {
    console.error('Error checking property and unit:', error)
  }
}

checkPropertyAndUnit()
