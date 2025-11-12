async function fetchJournalEntryFromBuildium(journalEntryId: string) {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/generalledger/journalentries/${journalEntryId}`

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

async function fetchJournalEntriesFromBuildium() {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/generalledger/journalentries`

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
    console.log('Fetching journal entries from Buildium...')
    const journalEntries = await fetchJournalEntriesFromBuildium()
    
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
      
      entry.Lines.forEach((line: any, lineIndex: number) => {
        console.log(`  Line ${lineIndex + 1}:`)
        console.log(`    GL Account ID: ${line.GLAccountId}`)
        console.log(`    Amount: ${line.Amount}`)
        console.log(`    Posting Type: ${line.PostingType}`)
        console.log(`    Memo: ${line.Memo || 'N/A'}`)
      })
      
      // Verify double-entry bookkeeping
      const totalCredits = entry.Lines
        .filter((line: any) => line.PostingType === 'Credit')
        .reduce((sum: number, line: any) => sum + line.Amount, 0)
      const totalDebits = entry.Lines
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
