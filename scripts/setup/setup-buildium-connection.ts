#!/usr/bin/env tsx

/**
 * Buildium Connection Setup Script
 * 
 * Purpose: Test Buildium API connection and validate credentials
 * Usage: npx tsx scripts/setup/setup-buildium-connection.ts
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testBuildiumConnection() {
  console.log('🔗 Testing Buildium API connection...\n')
  
  try {
    // Test Buildium API endpoint
    const buildiumUrl = process.env.BUILDIUM_BASE_URL!
    const clientId = process.env.BUILDIUM_CLIENT_ID!
    const clientSecret = process.env.BUILDIUM_CLIENT_SECRET!
    
    console.log('📡 Attempting to connect to Buildium API...')
    
    // Get access token
    const tokenResponse = await fetch(`${buildiumUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    
    if (!tokenResponse.ok) {
      throw new Error(`Failed to get access token: ${tokenResponse.status} ${tokenResponse.statusText}`)
    }
    
    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token
    
    console.log('✅ Successfully obtained Buildium access token')
    
    // Test API endpoint
    console.log('📡 Testing Buildium API endpoint...')
    
    const testResponse = await fetch(`${buildiumUrl}/properties`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })
    
    if (!testResponse.ok) {
      throw new Error(`API test failed: ${testResponse.status} ${testResponse.statusText}`)
    }
    
    const testData = await testResponse.json()
    
    console.log('✅ Buildium API connection successful!')
    console.log(`   Found ${testData.length || 0} properties in Buildium`)
    
    // Test local database connection
    console.log('\n🗄️ Testing local database connection...')
    
    const { data: properties, error: dbError } = await supabase
      .from('properties')
      .select('id, name')
      .limit(1)
    
    if (dbError) {
      throw new Error(`Database connection failed: ${dbError.message}`)
    }
    
    console.log('✅ Local database connection successful!')
    console.log(`   Found ${properties?.length || 0} properties in local database`)
    
    // Store connection status
    const { error: statusError } = await supabase
      .from('buildium_sync_status')
      .upsert({
        entity_type: 'connection_test',
        entity_id: 'buildium_api',
        status: 'synced',
        last_synced_at: new Date().toISOString(),
        error_message: null,
        buildium_id: null,
      })
    
    if (statusError) {
      console.warn('⚠️ Warning: Could not update sync status:', statusError.message)
    } else {
      console.log('✅ Connection status recorded in database')
    }
    
    console.log('\n🎯 Buildium connection setup complete!')
    console.log('   You can now proceed with data synchronization and entity creation.')
    
  } catch (error) {
    console.error('❌ Buildium connection test failed:', error)
    
    // Record failed connection status
    try {
      await supabase
        .from('buildium_sync_status')
        .upsert({
          entity_type: 'connection_test',
          entity_id: 'buildium_api',
          status: 'failed',
          last_synced_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : 'Unknown error',
          buildium_id: null,
        })
    } catch (statusError) {
      console.warn('⚠️ Warning: Could not record connection failure status', statusError)
    }
    
    process.exit(1)
  }
}

// Run setup if called directly
if (require.main === module) {
  testBuildiumConnection()
}

export { testBuildiumConnection }
