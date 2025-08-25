#!/usr/bin/env tsx

import 'dotenv/config'
import { supabase } from '../src/lib/db'

async function checkLocalProperty(propertyId: number) {
  console.log(`🔍 Checking for property ${propertyId} in local Supabase database...`)
  
  try {
    // Check if there's a property with this Buildium ID
    const { data: propertyWithBuildiumId, error: buildiumError } = await supabase
      .from('properties')
      .select('*')
      .eq('buildium_property_id', propertyId)
      .single()

    if (buildiumError && buildiumError.code !== 'PGRST116') {
      console.error('Error querying by buildium_property_id:', buildiumError)
    }

    if (propertyWithBuildiumId) {
      console.log('\n✅ Found property with Buildium ID:', propertyId)
      console.log('📋 Property Details:')
      console.log(JSON.stringify(propertyWithBuildiumId, null, 2))
      return propertyWithBuildiumId
    }

    // Check if there's a property with this ID as the primary key
    const { data: propertyWithId, error: idError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId.toString())
      .single()

    if (idError && idError.code !== 'PGRST116') {
      console.error('Error querying by id:', idError)
    }

    if (propertyWithId) {
      console.log('\n✅ Found property with ID:', propertyId)
      console.log('📋 Property Details:')
      console.log(JSON.stringify(propertyWithId, null, 2))
      return propertyWithId
    }

    // List all properties to see what's available
    console.log('\n📋 Listing all properties in database...')
    const { data: allProperties, error: listError } = await supabase
      .from('properties')
      .select('id, name, buildium_property_id, address_line1, city, state')
      .order('created_at', { ascending: false })
      .limit(10)

    if (listError) {
      console.error('Error listing properties:', listError)
      return null
    }

    console.log('\n📋 Available Properties:')
    allProperties?.forEach((prop, index) => {
      console.log(`${index + 1}. ID: ${prop.id}, Name: ${prop.name}, Buildium ID: ${prop.buildium_property_id || 'N/A'}, Address: ${prop.address_line1}, ${prop.city}, ${prop.state}`)
    })

    console.log(`\n❌ Property ${propertyId} not found in local database`)
    return null

  } catch (error) {
    console.error('Error checking local property:', error)
    return null
  }
}

// Execute the function
const propertyId = 7647
checkLocalProperty(propertyId)
  .then(() => {
    console.log('\nScript completed.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
