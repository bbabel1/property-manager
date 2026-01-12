import { config } from 'dotenv'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'
config({ path: '.env.local' })

async function fetchBuildiumProperty() {
  try {
    await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
    console.log('🔍 Fetching Buildium property 7647...')
    
    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/rentals/7647`, {
      method: 'GET',
      headers: {
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      'x-buildium-egress-allowed': '1',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const property = await response.json()
    console.log('✅ Property fetched successfully:')
    console.log(JSON.stringify(property, null, 2))
    
    return property
  } catch (error) {
    console.error('❌ Error fetching property:', error)
    throw error
  }
}

// Run the function
fetchBuildiumProperty()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
