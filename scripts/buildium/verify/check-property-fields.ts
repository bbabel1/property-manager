#!/usr/bin/env node

/**
 * Check what fields are available in the Buildium property response
 */

import { config } from 'dotenv'

// Load environment variables
config()

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

// Fetch property from Buildium to see all available fields
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

// Main function
async function checkPropertyFields() {
  try {
    const propertyId = 7647
    
    logger.info('Checking Buildium property fields...')
    logger.info(`Property ID: ${propertyId}`)
    
    // Validate environment variables
    if (!process.env.BUILDIUM_CLIENT_ID || !process.env.BUILDIUM_CLIENT_SECRET) {
      throw new Error('BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET must be set in environment variables')
    }
    
    // Fetch property from Buildium
    const buildiumProperty = await fetchPropertyFromBuildium(propertyId)
    
    logger.success('Full property response from Buildium:')
    console.log(JSON.stringify(buildiumProperty, null, 2))
    
    // Check for bank account related fields
    logger.info('Checking for bank account related fields...')
    const bankAccountFields = Object.keys(buildiumProperty).filter(key => 
      key.toLowerCase().includes('bank') || 
      key.toLowerCase().includes('account') || 
      key.toLowerCase().includes('trust') ||
      key.toLowerCase().includes('deposit')
    )
    
    if (bankAccountFields.length > 0) {
      logger.info('Found bank account related fields:')
      bankAccountFields.forEach(field => {
        console.log(`  ${field}: ${buildiumProperty[field]}`)
      })
    } else {
      logger.info('No bank account related fields found')
    }
    
    return buildiumProperty
    
  } catch (error) {
    logger.error('Property field check failed:', error)
    if (error instanceof Error) {
      logger.error('Error message:', error.message)
      logger.error('Error stack:', error.stack)
    }
    throw error
  }
}

// Run the script
if (require.main === module) {
  checkPropertyFields()
    .then(() => {
      logger.success('Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Script failed:', error)
      process.exit(1)
    })
}

export { checkPropertyFields }
