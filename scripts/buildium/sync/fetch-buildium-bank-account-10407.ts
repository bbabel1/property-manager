import { config } from 'dotenv'
config({ path: '.env.local' })

async function fetchBuildiumBankAccount() {
  try {
    console.log('🔍 Fetching Buildium bank account 10407...')
    
    // Use the v1 bankaccounts endpoint (previous /banking/accounts path returns 404)
    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/bankaccounts/10407`, {
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

    const bankAccount = await response.json()
    console.log('✅ Bank account fetched successfully:')
    console.log(JSON.stringify(bankAccount, null, 2))
    
    return bankAccount
  } catch (error) {
    console.error('❌ Error fetching bank account:', error)
    throw error
  }
}

// Run the function
fetchBuildiumBankAccount()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
