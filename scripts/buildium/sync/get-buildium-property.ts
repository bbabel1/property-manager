#!/usr/bin/env tsx

import 'dotenv/config'
import { buildiumEdgeClient } from '../src/lib/buildium-edge-client'

async function getBuildiumProperty(propertyId: number) {
  console.log(`Fetching property details from Buildium for property ID: ${propertyId}`)
  
  try {
    const result = await buildiumEdgeClient.getPropertyFromBuildium(propertyId)
    
    if (result.success && result.data) {
      console.log('\n✅ Property details retrieved successfully:')
      console.log(JSON.stringify(result.data, null, 2))
    } else {
      console.error('\n❌ Failed to retrieve property details:')
      console.error('Error:', result.error)
    }
  } catch (error) {
    console.error('\n❌ Unexpected error:')
    console.error(error)
  }
}

// Execute the function
const propertyId = 7647
getBuildiumProperty(propertyId)
  .then(() => {
    console.log('\nScript completed.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
