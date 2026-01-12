import { config } from 'dotenv'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'
config({ path: '.env.local' })

type JournalQuery = {
  startDate: string
  endDate: string
  glAccountIds: number[]
  selectionEntityId?: number
  selectionEntityType?: 'Rental' | 'RentalOwner' | 'Association'
  selectionEntityUnitId?: number
  lastUpdatedFrom?: string
  lastUpdatedTo?: string
  orderBy?: string
  offset?: number
  limit?: number
}

function toQuery(params: JournalQuery): string {
  const qp = new URLSearchParams()
  qp.set('startdate', params.startDate)
  qp.set('enddate', params.endDate)
  qp.set('glaccountids', params.glAccountIds.join(','))
  if (params.selectionEntityId != null) qp.set('selectionentityid', String(params.selectionEntityId))
  if (params.selectionEntityType) qp.set('selectionentitytype', params.selectionEntityType)
  if (params.selectionEntityUnitId != null) qp.set('selectionentityunitid', String(params.selectionEntityUnitId))
  if (params.lastUpdatedFrom) qp.set('lastupdatedfrom', params.lastUpdatedFrom)
  if (params.lastUpdatedTo) qp.set('lastupdatedto', params.lastUpdatedTo)
  if (params.orderBy) qp.set('orderby', params.orderBy)
  if (params.offset != null) qp.set('offset', String(params.offset))
  if (params.limit != null) qp.set('limit', String(params.limit))
  return qp.toString()
}

async function fetchJournalEntryFromBuildium(journalEntryId: string) {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/generalledger/transactions/${journalEntryId}`

  const response = await fetch(buildiumUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      'x-buildium-egress-allowed': '1',
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
  }

  return response.json()
}

async function fetchJournalEntriesFromBuildium(params: JournalQuery) {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/generalledger/transactions?${toQuery(params)}`

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
    await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
    // Default: last 30 days, GL account IDs sourced from Buildium bank accounts
    const glAccounts = [10407, 10408, 10409, 10410, 10411, 10412, 10413, 10414, 10415, 10416, 13162, 13163, 14011, 14368]
    const now = new Date()
    const end = now.toISOString().split('T')[0]
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    console.log('Fetching journal entries from Buildium...')
    const journalEntries = await fetchJournalEntriesFromBuildium({
      startDate: start,
      endDate: end,
      glAccountIds: glAccounts,
      limit: 50,
      offset: 0,
    })
    
    console.log(`\n=== FOUND ${journalEntries.length} JOURNAL ENTRIES ===`)
    
    // Show first few journal entries to understand the structure
    journalEntries.slice(0, 3).forEach((entry: any, index: number) => {
      console.log(`\n=== JOURNAL ENTRY ${index + 1} ===`)
      console.log(`ID: ${entry.Id}`)
      console.log(`Date: ${entry.Date}`)
      console.log(`Memo: ${entry.Memo}`)
      console.log(`Transaction Type: ${entry.TransactionType}`)
      console.log(`Total Amount: ${entry.TotalAmount}`)
      console.log(`Lines:`)
      
      const lines = Array.isArray(entry.Lines) ? entry.Lines : []
      lines.forEach((line: any, lineIndex: number) => {
        console.log(`  Line ${lineIndex + 1}:`)
        console.log(`    GL Account ID: ${line.GLAccountId}`)
        console.log(`    Amount: ${line.Amount}`)
        console.log(`    Posting Type: ${line.PostingType}`)
        console.log(`    Memo: ${line.Memo || 'N/A'}`)
      })
      
      // Verify double-entry bookkeeping
      const totalCredits = lines
        .filter((line: any) => line.PostingType === 'Credit')
        .reduce((sum: number, line: any) => sum + line.Amount, 0)
      const totalDebits = lines
        .filter((line: any) => line.PostingType === 'Debit')
        .reduce((sum: number, line: any) => sum + line.Amount, 0)
      
      console.log(`  Double-Entry Check:`)
      console.log(`    Total Credits: $${totalCredits}`)
      console.log(`    Total Debits: $${totalDebits}`)
      console.log(`    Balanced: ${totalCredits === totalDebits ? '✅ YES' : '❌ NO'}`)
    })
    
    // If we have journal entries, fetch details for the first one
    if (journalEntries.length > 0) {
      const firstEntry = journalEntries[0]
      console.log(`\n=== DETAILED ANALYSIS OF JOURNAL ENTRY ${firstEntry.Id} ===`)
      
      const detailedEntry = await fetchJournalEntryFromBuildium(firstEntry.Id)
      console.log('Detailed entry:', JSON.stringify(detailedEntry, null, 2))
    }
    
  } catch (error) {
    console.error('Failed to fetch journal entries:', error)
    process.exit(1)
  }
}

main()
