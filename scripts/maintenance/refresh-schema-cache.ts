#!/usr/bin/env npx tsx

/**
 * Refresh Schema Cache Script
 * 
 * This script refreshes the materialized views created for schema introspection
 * to improve query performance by reducing the need for complex joins on system catalogs.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function refreshSchemaCache() {
  console.log('🔄 Refreshing schema cache...')
  
  try {
    // Refresh the materialized views
    const { error } = await supabase.rpc('refresh_schema_cache')
    
    if (error) {
      console.error('❌ Error refreshing schema cache:', error)
      process.exit(1)
    }
    
    console.log('✅ Schema cache refreshed successfully!')
    
    // Get some stats about the cached data
    const { data: tableStats } = await supabase
      .from('table_info_cache')
      .select('count', { count: 'exact' })
    
    const { data: columnStats } = await supabase
      .from('column_info_cache')
      .select('count', { count: 'exact' })
    
    console.log(`📊 Cached ${tableStats?.[0]?.count || 0} tables and ${columnStats?.[0]?.count || 0} columns`)
    
  } catch (err) {
    console.error('❌ Unexpected error:', err)
    process.exit(1)
  }
}

// Run the refresh
refreshSchemaCache()
