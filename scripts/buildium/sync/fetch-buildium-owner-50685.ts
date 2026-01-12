import { config } from 'dotenv'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'
config({ path: '.env.local' })

async function fetchBuildiumOwner() {
  try {
    await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
    console.log('🔍 Fetching Buildium owner 50685...')
    
    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/rentals/owners/50685`, {
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

    const owner = await response.json()
    console.log('✅ Owner fetched successfully:')
    console.log(JSON.stringify(owner, null, 2))
    
    return owner
  } catch (error) {
    console.error('❌ Error fetching owner:', error)
    throw error
  }
}

// Run the function
fetchBuildiumOwner()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
