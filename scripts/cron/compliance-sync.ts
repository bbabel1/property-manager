#!/usr/bin/env -S node --loader tsx
import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { ComplianceSyncService } from '@/lib/compliance-sync-service'
import { logger } from '@/lib/logger'

async function main() {
  if (process.env.ENABLE_COMPLIANCE_SYNC === '0' || process.env.ENABLE_COMPLIANCE_SYNC === 'false') {
    console.log('Compliance sync disabled via ENABLE_COMPLIANCE_SYNC')
    return
  }

  if ((process.env.TZ || '').toLowerCase() !== 'america/new_york') {
    console.warn('Warning: TZ is not America/New_York; set TZ=America/New_York for correct timing')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const syncService = new ComplianceSyncService()

  const start = Date.now()

  try {
    // Get all active organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true)

    if (orgsError) {
      logger.error({ error: orgsError }, 'Failed to fetch organizations for compliance sync')
      process.exit(1)
    }

    if (!orgs || orgs.length === 0) {
      logger.info('No active organizations found for compliance sync')
      return
    }

    let totalSynced = 0
    let totalErrors = 0

    // Sync compliance for each org
    for (const org of orgs) {
      try {
        // Get properties with BIN for this org
        const { data: properties, error: propertiesError } = await supabase
          .from('properties')
          .select('id, bin')
          .eq('org_id', org.id)
          .not('bin', 'is', null)

        if (propertiesError) {
          logger.error({ error: propertiesError, orgId: org.id }, 'Failed to fetch properties for compliance sync')
          totalErrors++
          continue
        }

        if (!properties || properties.length === 0) {
          logger.info({ orgId: org.id }, 'No properties with BIN found for compliance sync')
          continue
        }

        // Sync each property
        for (const property of properties) {
          try {
            const result = await syncService.syncPropertyCompliance(property.id, org.id, false)

            if (result.success) {
              totalSynced++
              logger.info(
                {
                  propertyId: property.id,
                  orgId: org.id,
                  synced_assets: result.synced_assets,
                  synced_events: result.synced_events,
                  synced_violations: result.synced_violations,
                  updated_items: result.updated_items,
                },
                'Compliance sync completed for property'
              )
            } else {
              totalErrors++
              logger.error(
                {
                  propertyId: property.id,
                  orgId: org.id,
                  errors: result.errors,
                },
                'Compliance sync failed for property'
              )
            }
          } catch (error) {
            totalErrors++
            logger.error(
              { error, propertyId: property.id, orgId: org.id },
              'Error syncing compliance for property'
            )
          }
        }
      } catch (error) {
        totalErrors++
        logger.error({ error, orgId: org.id }, 'Error syncing compliance for org')
      }
    }

    logger.info(
      {
        total_orgs: orgs.length,
        total_synced: totalSynced,
        total_errors: totalErrors,
        duration_ms: Date.now() - start,
        correlation_id: 'cron:compliance-sync',
      },
      'Compliance sync run complete'
    )
  } catch (error) {
    logger.error({ error, duration_ms: Date.now() - start }, 'Compliance sync cron failed')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Compliance sync cron failed:', e)
  process.exit(1)
})
