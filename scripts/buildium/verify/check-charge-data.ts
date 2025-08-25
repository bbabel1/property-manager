import { config } from 'dotenv'

config()

async function fetchChargesFromBuildium(leaseId: string) {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/${leaseId}/charges`

  const response = await fetch(buildiumUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
  }

  return response.json()
}

async function main() {
  try {
    console.log('Fetching charges for lease 16235...')
    const charges = await fetchChargesFromBuildium('16235')
    
    console.log('\n=== CHARGE DATA ANALYSIS ===')
    charges.forEach((charge: any, index: number) => {
      console.log(`\nCharge ${index + 1}:`)
      console.log(`- ID: ${charge.Id}`)
      console.log(`- Date: ${charge.Date}`)
      console.log(`- Total Amount: ${charge.TotalAmount}`)
      console.log(`- Memo: ${charge.Memo}`)
      console.log(`- Lines:`)
      charge.Lines.forEach((line: any, lineIndex: number) => {
        console.log(`  Line ${lineIndex + 1}: GL Account ${line.GLAccountId}, Amount: ${line.Amount}`)
      })
    })
    
    console.log('\n=== POSTING TYPE ANALYSIS ===')
    console.log('For a charge (liability increase):')
    console.log('- Income accounts (Rent Income) should be CREDITED (income earned)')
    console.log('- Liability accounts (Security Deposit) should be CREDITED (liability increases)')
    console.log('- The corresponding DEBIT would typically be to Accounts Receivable or similar')
    
  } catch (error) {
    console.error('Failed to fetch charges:', error)
    process.exit(1)
  }
}

main()
