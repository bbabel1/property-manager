import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { logger } from '../../utils/logger'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const leaseId = '16235'

interface BuildiumCharge {
  Id: number
  Date: string
  TotalAmount: number
  Memo: string
  BillId: number | null
  Lines: Array<{
    Amount: number
    GLAccountId: number
  }>
}

async function fetchChargesFromBuildium(leaseId: string): Promise<BuildiumCharge[]> {
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

async function getLocalLeaseId(buildiumLeaseId: number): Promise<number> {
  const { data: lease, error } = await supabase
    .from('lease')
    .select('id')
    .eq('buildium_lease_id', buildiumLeaseId)
    .single()

  if (error) {
    throw new Error(`Failed to find local lease ID for Buildium lease ${buildiumLeaseId}: ${error.message}`)
  }

  return lease.id
}

async function createTransactionRecord(charge: BuildiumCharge, localLeaseId: number) {
  const transactionData = {
    buildium_transaction_id: charge.Id,
    date: charge.Date,
    transaction_type: 'Charge',
    total_amount: charge.TotalAmount,
    buildium_lease_id: parseInt(leaseId),
    memo: charge.Memo,
    buildium_bill_id: charge.BillId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('transactions')
    .upsert(transactionData, {
      onConflict: 'buildium_transaction_id'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create transaction record: ${error.message}`)
  }

  return data
}

async function main() {
  try {
    logger.info(`Fetching charges for lease ${leaseId} from Buildium...`)
    const charges = await fetchChargesFromBuildium(leaseId)
    
    logger.info(`Found ${charges.length} charges`)
    
    logger.info('Getting local lease ID...')
    const localLeaseId = await getLocalLeaseId(parseInt(leaseId))
    
    logger.info('Creating transaction records...')
    const transactionIds: string[] = []
    
    for (const charge of charges) {
      logger.info(`Creating transaction for charge ${charge.Id} (${charge.Memo})...`)
      const transaction = await createTransactionRecord(charge, localLeaseId)
      transactionIds.push(transaction.id)
      
      console.log(`✅ Created transaction: ${transaction.id}`)
      console.log(`   Buildium ID: ${charge.Id}`)
      console.log(`   Amount: $${charge.TotalAmount}`)
      console.log(`   Memo: ${charge.Memo}`)
      console.log(`   Date: ${charge.Date}`)
      console.log(`   GL Lines: ${charge.Lines.length} line(s)`)
    }
    
    logger.info('Successfully created all transaction records!')
    console.log('\n=== SUMMARY ===')
    console.log(`Created ${transactionIds.length} transaction records`)
    console.log('Transaction IDs:', transactionIds)
    console.log('All charges have been successfully mapped to the transactions table')
    
  } catch (error) {
    logger.error({ error }, 'Failed to create transaction records')
    console.error('Full error details:', error)
    process.exit(1)
  }
}

main()
