#!/usr/bin/env tsx

/**
 * Environment Setup Script
 * 
 * Purpose: Validate environment variables and configuration
 * Usage: npx tsx scripts/setup/setup-environment.ts
 */

import { config } from 'dotenv'
import { z } from 'zod'

// Load environment variables
config()

// Environment validation schema
const envSchema = z.object({
  // Supabase Configuration
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),
  
  // Buildium Configuration
  BUILDIUM_CLIENT_ID: z.string().min(1, 'Buildium client ID is required'),
  BUILDIUM_CLIENT_SECRET: z.string().min(1, 'Buildium client secret is required'),
  BUILDIUM_BASE_URL: z.string().url('Invalid Buildium base URL'),
  
  // Optional Buildium Configuration
  BUILDIUM_WEBHOOK_SECRET: z.string().optional(),
  
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

async function setupEnvironment() {
  console.log('🔧 Setting up environment configuration...\n')
  
  try {
    // Validate environment variables
    const env = envSchema.parse(process.env)
    
    console.log('✅ Environment validation successful!')
    console.log('\n📋 Configuration Summary:')
    console.log(`   Environment: ${env.NODE_ENV}`)
    console.log(`   Supabase URL: ${env.NEXT_PUBLIC_SUPABASE_URL}`)
    console.log(`   Buildium Base URL: ${env.BUILDIUM_BASE_URL}`)
    console.log(`   Buildium Client ID: ${env.BUILDIUM_CLIENT_ID.substring(0, 8)}...`)
    console.log(`   Webhook Secret: ${env.BUILDIUM_WEBHOOK_SECRET ? 'Configured' : 'Not configured'}`)
    
    console.log('\n🎯 Environment setup complete!')
    console.log('   You can now proceed with database setup and Buildium connection testing.')
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:')
      error.errors.forEach((err) => {
        console.error(`   - ${err.path.join('.')}: ${err.message}`)
      })
      console.error('\n💡 Please check your .env file and ensure all required variables are set.')
      process.exit(1)
    } else {
      console.error('❌ Unexpected error during environment setup:', error)
      process.exit(1)
    }
  }
}

// Run setup if called directly
if (require.main === module) {
  setupEnvironment()
}

export { setupEnvironment }
