import { config } from 'dotenv'
config({ path: '.env.local' })

import { buildiumFetch } from '@/lib/buildium-http'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

async function fetchBuildiumBankAccounts() {
  const { orgId } = await ensureBuildiumEnabledForScript()

  console.log('🔍 Fetching all Buildium bank accounts...')
  const response = await buildiumFetch('GET', '/bankaccounts', undefined, undefined, orgId)

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} ${response.errorText || ''}`)
  }

  const bankAccounts = response.json
  console.log('✅ Bank accounts fetched successfully:')
  console.log(JSON.stringify(bankAccounts, null, 2))
    
  return bankAccounts
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
