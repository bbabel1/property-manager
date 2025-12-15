import { config } from 'dotenv'
config({ path: '.env.local' })

async function fetchBuildiumBankAccounts() {
  try {
    console.log('🔍 Fetching all Buildium bank accounts...')
    
    // Use the v1 bankaccounts endpoint (previous /banking/accounts path returns 404)
    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/bankaccounts`, {
      method: 'GET',
      headers: {
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const bankAccounts = await response.json()
    console.log('✅ Bank accounts fetched successfully:')
    console.log(JSON.stringify(bankAccounts, null, 2))
    
    return bankAccounts
  } catch (error) {
    console.error('❌ Error fetching bank accounts:', error)
    throw error
  }
}

// Run the function
fetchBuildiumBankAccounts()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
