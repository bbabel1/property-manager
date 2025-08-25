#!/usr/bin/env node

/**
 * Set Property 7647's deposit trust account to the same as operating bank account
 * Since Buildium doesn't have a separate deposit trust account field
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

// Get property with current bank account links
async function getPropertyWithBankAccounts() {
  logger.info('Getting property with current bank account links...')
  
  const { data: property, error } = await supabase
    .from('properties')
    .select(`
      *,
      operating_bank:bank_accounts!operating_bank_account_id(*),
      trust_bank:bank_accounts!deposit_trust_account_id(*)
    `)
    .eq('buildium_property_id', 7647)
    .single()

  if (error) {
    logger.error(`Error fetching property: ${error.message}`)
    throw error
  }

  if (!property) {
    throw new Error('Property not found')
  }

  logger.success(`Found property: ${property.name}`)
  return property
}

// Update property to set deposit trust account to same as operating bank account
async function updatePropertyTrustAccount(propertyId: string, bankAccountId: string) {
  logger.info(`Setting deposit trust account to same as operating bank account: ${bankAccountId}`)
  
  const { data: updatedProperty, error } = await supabase
    .from('properties')
    .update({
      deposit_trust_account_id: bankAccountId,
      updated_at: new Date().toISOString()
    })
    .eq('id', propertyId)
    .select(`
      *,
      operating_bank:bank_accounts!operating_bank_account_id(*),
      trust_bank:bank_accounts!deposit_trust_account_id(*)
    `)
    .single()

  if (error) {
    logger.error(`Error updating property: ${error.message}`)
    throw error
  }

  logger.success(`Successfully updated property with deposit trust account`)
  return updatedProperty
}

// Main function
async function setPropertyTrustAccount() {
  try {
    const propertyId = 7647
    
    logger.info('Starting property deposit trust account setup...')
    logger.info(`Property ID: ${propertyId}`)
    
    // Validate environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables')
    }
    
    // 1. Get current property with bank account links
    const property = await getPropertyWithBankAccounts()
    
    logger.info('Current property bank account setup:', {
      name: property.name,
      operating_bank_account_id: property.operating_bank_account_id,
      deposit_trust_account_id: property.deposit_trust_account_id,
      operating_bank_name: property.operating_bank?.name,
      trust_bank_name: property.trust_bank?.name
    })
    
    // 2. If deposit trust account is not set, set it to the same as operating bank account
    if (!property.deposit_trust_account_id && property.operating_bank_account_id) {
      logger.info('Deposit trust account not set, setting to same as operating bank account')
      
      const updatedProperty = await updatePropertyTrustAccount(property.id, property.operating_bank_account_id)
      
      logger.success('Property deposit trust account setup completed successfully!')
      logger.info('Updated property details:', {
        id: updatedProperty.id,
        name: updatedProperty.name,
        buildium_property_id: updatedProperty.buildium_property_id,
        operating_bank_account_id: updatedProperty.operating_bank_account_id,
        deposit_trust_account_id: updatedProperty.deposit_trust_account_id,
        operating_bank_name: updatedProperty.operating_bank?.name,
        trust_bank_name: updatedProperty.trust_bank?.name
      })
      
      return updatedProperty
    } else if (property.deposit_trust_account_id) {
      logger.info('Deposit trust account already set')
      return property
    } else {
      logger.info('No operating bank account set, cannot set deposit trust account')
      return property
    }
    
  } catch (error) {
    logger.error('Property deposit trust account setup failed:', error)
    if (error instanceof Error) {
      logger.error('Error message:', error.message)
      logger.error('Error stack:', error.stack)
    }
    throw error
  }
}

// Run the script
if (require.main === module) {
  setPropertyTrustAccount()
    .then(() => {
      logger.success('Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Script failed:', error)
      process.exit(1)
    })
}


