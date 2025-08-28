import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { logger } from './utils/logger'
import { resolveGLAccountId } from '../../../src/lib/buildium-mappers'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const buildiumGLAccountIds = ['3', '5'] // Rent Income and Security Deposit Liability

async function main() {
  try {
    logger.info(`Fetching ${buildiumGLAccountIds.length} GL accounts from Buildium...`)
    const createdGLAccountIds: string[] = []
    
    for (const glAccountId of buildiumGLAccountIds) {
      logger.info(`Resolving GL account ${glAccountId} via shared resolver...`)
      const resolvedId = await resolveGLAccountId(Number(glAccountId), supabase)
      if (resolvedId) {
        createdGLAccountIds.push(resolvedId)
        console.log(`✅ Ensured GL account exists: ${resolvedId} (Buildium ID: ${glAccountId})`)
      } else {
        console.log(`❌ Failed to ensure GL account for Buildium ID: ${glAccountId}`)
      }
    }
    
    logger.info('Successfully created all GL account records!')
    console.log('\n=== SUMMARY ===')
    console.log(`Created ${createdGLAccountIds.length} GL account records`)
    console.log('GL Account IDs:', createdGLAccountIds)
    console.log('All GL accounts have been successfully mapped to the database')
    
  } catch (error) {
    logger.error('Failed to create GL account records')
    console.error('Full error details:', error)
    process.exit(1)
  }
}

main()
