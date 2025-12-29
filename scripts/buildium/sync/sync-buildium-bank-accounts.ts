#!/usr/bin/env tsx

/**
 * Script to sync bank accounts from Buildium to local database
 * 
 * Usage:
 * npm run sync:bank-accounts
 * 
 * This script will:
 * 1. Fetch all bank accounts from Buildium API
 * 2. Map them to local database format
 * 3. Insert or update records in the local database
 * 4. Track sync status and errors
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { logger } from '../../utils/logger'

// Load environment variables
config()

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Buildium API configuration
const buildiumConfig = {
  baseUrl: process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1',
  clientId: process.env.BUILDIUM_CLIENT_ID!,
  clientSecret: process.env.BUILDIUM_CLIENT_SECRET!,
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
}

if (!buildiumConfig.clientId || !buildiumConfig.clientSecret) {
  console.error('Missing BUILDIUM_CLIENT_ID or BUILDIUM_CLIENT_SECRET environment variables')
  process.exit(1)
}

interface BuildiumBankAccount {
  Id: number
  Name: string
  BankAccountType: 'Checking' | 'Savings' | 'MoneyMarket' | 'CertificateOfDeposit'
  AccountNumber: string
  RoutingNumber: string
  Description?: string
  IsActive: boolean
  CreatedDate: string
  ModifiedDate: string
}

async function fetchBankAccountsFromBuildium(): Promise<BuildiumBankAccount[]> {
  const allBankAccounts: BuildiumBankAccount[] = []
  let pageNumber = 1
  const pageSize = 100

  logger.info('Starting to fetch bank accounts from Buildium')

  while (true) {
    try {
      const url = `${buildiumConfig.baseUrl}/bankaccounts?pageSize=${pageSize}&pageNumber=${pageNumber}`
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-buildium-client-id': buildiumConfig.clientId,
          'x-buildium-client-secret': buildiumConfig.clientSecret,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Buildium API error: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      // Handle different response formats
      let bankAccounts: BuildiumBankAccount[] = []
      let totalCount = 0
      
      if (Array.isArray(result)) {
        // Direct array response
        bankAccounts = result
        totalCount = result.length
      } else if (result.data && Array.isArray(result.data)) {
        // Wrapped response with data array
        bankAccounts = result.data
        totalCount = result.totalCount || result.data.length
      } else if (result.value && Array.isArray(result.value)) {
        // OData-style response
        bankAccounts = result.value
        totalCount = result['@odata.count'] || result.value.length
      } else {
        throw new Error(`Unexpected response format: ${JSON.stringify(result)}`)
      }
      
      logger.info(`Fetched page ${pageNumber} with ${bankAccounts.length} bank accounts`)
      
      allBankAccounts.push(...bankAccounts)

      // Check if we've fetched all pages
      if (bankAccounts.length < pageSize || pageNumber * pageSize >= totalCount) {
        break
      }

      pageNumber++
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error fetching bank accounts from Buildium')
      throw error
    }
  }

  logger.info(`Total bank accounts fetched from Buildium: ${allBankAccounts.length}`)
  return allBankAccounts
}

function mapBuildiumBankAccountToLocal(buildiumAccount: BuildiumBankAccount) {
  return {
    buildium_bank_id: buildiumAccount.Id,
    name: buildiumAccount.Name,
    bank_account_type: buildiumAccount.BankAccountType.toLowerCase(),
    account_number: buildiumAccount.AccountNumber,
    routing_number: buildiumAccount.RoutingNumber,
    description: buildiumAccount.Description,
    country: 'US', // Default to US for Buildium accounts
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

async function syncBankAccountsToDatabase(bankAccounts: BuildiumBankAccount[]) {
  let syncedCount = 0
  let updatedCount = 0
  let errorCount = 0
  const errors: string[] = []

  logger.info(`Starting to sync ${bankAccounts.length} bank accounts to database`)

  for (const buildiumAccount of bankAccounts) {
    try {
      const localData = mapBuildiumBankAccountToLocal(buildiumAccount)

      // Check if bank account already exists
      const { data: existingAccount } = await supabase
        .from('bank_accounts')
        .select('id')
        .eq('buildium_bank_id', buildiumAccount.Id)
        .single()

      if (existingAccount) {
        // Update existing account
        const { error: updateError } = await supabase
          .from('bank_accounts')
          .update({
            ...localData,
            updated_at: new Date().toISOString()
          })
          .eq('buildium_bank_id', buildiumAccount.Id)

        if (updateError) {
          throw updateError
        }

        updatedCount++
        logger.info(`Updated bank account: ${buildiumAccount.Name} (ID: ${buildiumAccount.Id})`)
      } else {
        // Insert new account
        const { error: insertError } = await supabase
          .from('bank_accounts')
          .insert(localData)

        if (insertError) {
          throw insertError
        }

        syncedCount++
        logger.info(`Synced new bank account: ${buildiumAccount.Name} (ID: ${buildiumAccount.Id})`)
      }
    } catch (error) {
      errorCount++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Failed to sync bank account ${buildiumAccount.Name} (ID: ${buildiumAccount.Id}): ${errorMessage}`)
      logger.error({ 
        error: errorMessage, 
        bankAccountId: buildiumAccount.Id,
        bankAccountName: buildiumAccount.Name 
      }, 'Error syncing bank account')
    }
  }

  return {
    syncedCount,
    updatedCount,
    errorCount,
    errors
  }
}

async function main() {
  try {
    logger.info('Starting Buildium bank accounts sync process')

    // Step 1: Fetch bank accounts from Buildium
    const buildiumBankAccounts = await fetchBankAccountsFromBuildium()

    if (buildiumBankAccounts.length === 0) {
      logger.info('No bank accounts found in Buildium')
      return
    }

    // Step 2: Sync to local database
    const syncResult = await syncBankAccountsToDatabase(buildiumBankAccounts)

    // Step 3: Log results
    logger.info({
      totalFetched: buildiumBankAccounts.length,
      syncedCount: syncResult.syncedCount,
      updatedCount: syncResult.updatedCount,
      errorCount: syncResult.errorCount
    }, 'Bank accounts sync completed')

    if (syncResult.errors.length > 0) {
      logger.error({ errors: syncResult.errors }, 'Some bank accounts failed to sync')
    }

    // Step 4: Verify sync by counting local records
    const { count: localCount, error: countError } = await supabase
      .from('bank_accounts')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      logger.error({ error: countError.message }, 'Error counting local bank accounts')
    } else {
      logger.info({ localBankAccountCount: localCount }, 'Local database bank account count')
    }

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Bank accounts sync failed')
    process.exit(1)
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      logger.info('Bank accounts sync script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Bank accounts sync script failed')
      process.exit(1)
    })
}
