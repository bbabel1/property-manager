#!/usr/bin/env node

/**
 * Link Property 7647's deposit trust account to the local bank account record
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Logger
const logger = {
  info: (message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`ℹ️ [${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  success: (message: string, data?: any) => {
    const timestamp = new Date().toISOString()
    console.log(`✅ [${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '')
  },
  error: (message: string, error?: any) => {
    const timestamp = new Date().toISOString()
    console.error(`❌ [${timestamp}] ${message}`, error ? JSON.stringify(error, null, 2) : '')
  }
}

// Fetch property from Buildium to get the deposit trust account ID
async function fetchPropertyFromBuildium(propertyId: number) {
  logger.info(`Fetching property ${propertyId} from Buildium API...`)
  
  const buildiumConfig = {
    baseUrl: process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1',
    clientId: process.env.BUILDIUM_CLIENT_ID!,
    clientSecret: process.env.BUILDIUM_CLIENT_SECRET!
  }
  
  const endpoint = `/rentals/${propertyId}`
  
  try {
    const url = `${buildiumConfig.baseUrl}${endpoint}`
    logger.info(`Making request to: ${url}`)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-buildium-client-id': buildiumConfig.clientId,
        'x-buildium-client-secret': buildiumConfig.clientSecret,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const property = await response.json()
      logger.success(`Successfully fetched property from Buildium`)
      return property
    } else {
      const errorText = await response.text()
      logger.error(`Buildium API error: ${response.status} ${response.statusText}`)
      logger.error(`Error response: ${errorText}`)
      throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${errorText}`)
    }
  } catch (error) {
    logger.error('Error fetching property from Buildium:', error)
    throw error
  }
}

// Find bank account by Buildium bank ID
async function findBankAccountByBuildiumId(buildiumBankId: number) {
  logger.info(`Looking for bank account with Buildium ID: ${buildiumBankId}`)
  
  const { data: bankAccount, error } = await supabase
    .from('bank_accounts')
    .select('*')
    .eq('buildium_bank_id', buildiumBankId)
    .single()

  if (error) {
    logger.error(`Error finding bank account: ${error.message}`)
    throw error
  }

  if (!bankAccount) {
    throw new Error(`No bank account found with Buildium ID: ${buildiumBankId}`)
  }

  logger.success(`Found bank account: ${bankAccount.name} (ID: ${bankAccount.id})`)
  return bankAccount
}

// Update property with deposit trust account link
async function updatePropertyTrustAccount(propertyId: string, bankAccountId: string) {
  logger.info(`Updating property ${propertyId} with deposit trust account ${bankAccountId}`)
  
  const { data: updatedProperty, error } = await supabase
    .from('properties')
    .update({
      deposit_trust_account_id: bankAccountId,
      updated_at: new Date().toISOString()
    })
    .eq('id', propertyId)
    .select()
    .single()

  if (error) {
    logger.error(`Error updating property: ${error.message}`)
    throw error
  }

  logger.success(`Successfully updated property with deposit trust account link`)
  return updatedProperty
}

// Main function
async function linkPropertyTrustAccount() {
  try {
    const propertyId = 7647
    
    logger.info('Starting property deposit trust account linking process...')
    logger.info(`Property ID: ${propertyId}`)
    
    // Validate environment variables
    if (!process.env.BUILDIUM_CLIENT_ID || !process.env.BUILDIUM_CLIENT_SECRET) {
      throw new Error('BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET must be set in environment variables')
    }
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables')
    }
    
    // 1. Fetch property from Buildium to get deposit trust account ID
    const buildiumProperty = await fetchPropertyFromBuildium(propertyId)
    logger.info('Property data from Buildium:', {
      name: buildiumProperty.Name,
      operatingBankAccountId: buildiumProperty.OperatingBankAccountId,
      depositTrustAccountId: buildiumProperty.DepositTrustAccountId
    })
    
    if (!buildiumProperty.DepositTrustAccountId) {
      logger.info('Property does not have a deposit trust account ID')
      return null
    }
    
    // 2. Find the corresponding bank account in local database
    const bankAccount = await findBankAccountByBuildiumId(buildiumProperty.DepositTrustAccountId)
    
    // 3. Get the local property record
    const { data: localProperty, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('buildium_property_id', propertyId)
      .single()
    
    if (propertyError) {
      throw new Error(`Error finding local property: ${propertyError.message}`)
    }
    
    if (!localProperty) {
      throw new Error(`No local property found with Buildium ID: ${propertyId}`)
    }
    
    logger.info(`Found local property: ${localProperty.name} (ID: ${localProperty.id})`)
    
    // 4. Update property with deposit trust account link
    const updatedProperty = await updatePropertyTrustAccount(localProperty.id, bankAccount.id)
    
    logger.success('Property deposit trust account linking completed successfully!')
    logger.info('Updated property details:', {
      id: updatedProperty.id,
      name: updatedProperty.name,
      buildium_property_id: updatedProperty.buildium_property_id,
      deposit_trust_account_id: updatedProperty.deposit_trust_account_id,
      bank_account_name: bankAccount.name,
      bank_account_buildium_id: bankAccount.buildium_bank_id
    })
    
    return updatedProperty
    
  } catch (error) {
    logger.error('Property deposit trust account linking failed:', error)
    if (error instanceof Error) {
      logger.error('Error message:', error.message)
      logger.error('Error stack:', error.stack)
    }
    throw error
  }
}

// Run the script
if (require.main === module) {
  linkPropertyTrustAccount()
    .then(() => {
      logger.success('Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Script failed:', error)
      process.exit(1)
    })
}

export { linkPropertyTrustAccount }
