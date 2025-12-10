#!/usr/bin/env -S node --loader tsx
import 'dotenv/config'
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { ComplianceItemGenerator } from '../../src/lib/compliance-item-generator'
import { logger } from '../../src/lib/logger'

async function main() {
  if (process.env.ENABLE_COMPLIANCE_ITEM_GENERATION === '0' || process.env.ENABLE_COMPLIANCE_ITEM_GENERATION === 'false') {
    console.log('Compliance item generation disabled via ENABLE_COMPLIANCE_ITEM_GENERATION')
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
  const generator = new ComplianceItemGenerator()

  const start = Date.now()
  const periodsAhead = Number(process.env.COMPLIANCE_ITEM_PERIODS_AHEAD || '12')

  try {
    // Get all active organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id')
      .eq('is_active', true)

    if (orgsError) {
      logger.error({ error: orgsError }, 'Failed to fetch organizations for compliance item generation')
      process.exit(1)
    }

    if (!orgs || orgs.length === 0) {
      logger.info('No active organizations found for compliance item generation')
      return
    }

    let totalCreated = 0
    let totalSkipped = 0
    let totalErrors = 0

    // Generate items for each org
    for (const org of orgs) {
      try {
        // Get all active properties for this org
        const { data: properties, error: propertiesError } = await supabase
          .from('properties')
          .select('id')
          .eq('org_id', org.id)
          .eq('status', 'Active')

        if (propertiesError) {
          logger.error({ error: propertiesError, orgId: org.id }, 'Failed to fetch properties for compliance item generation')
          totalErrors++
          continue
        }

        if (!properties || properties.length === 0) {
          logger.info({ orgId: org.id }, 'No active properties found for compliance item generation')
          continue
        }

        // Generate items for each property
        for (const property of properties) {
          try {
            const result = await generator.generateItemsForProperty(property.id, org.id, periodsAhead)

            totalCreated += result.items_created
            totalSkipped += result.items_skipped

            if (result.errors && result.errors.length > 0) {
              totalErrors++
              logger.error(
                {
                  propertyId: property.id,
                  orgId: org.id,
                  errors: result.errors,
                },
                'Errors generating compliance items for property'
              )
            } else {
              logger.info(
                {
                  propertyId: property.id,
                  orgId: org.id,
                  items_created: result.items_created,
                  items_skipped: result.items_skipped,
                },
                'Compliance items generated for property'
              )
            }
          } catch (error) {
            totalErrors++
            logger.error(
              { error, propertyId: property.id, orgId: org.id },
              'Error generating compliance items for property'
            )
          }
        }

        // Also generate items for assets
        const { data: assets, error: assetsError } = await supabase
          .from('compliance_assets')
          .select('id')
          .eq('org_id', org.id)
          .eq('active', true)

        if (!assetsError && assets && assets.length > 0) {
          for (const asset of assets) {
            try {
              const result = await generator.generateItemsForAsset(asset.id, org.id, periodsAhead)

              totalCreated += result.items_created
              totalSkipped += result.items_skipped

              if (result.errors && result.errors.length > 0) {
                logger.error(
                  {
                    assetId: asset.id,
                    orgId: org.id,
                    errors: result.errors,
                  },
                  'Errors generating compliance items for asset'
                )
              }
            } catch (error) {
              logger.error(
                { error, assetId: asset.id, orgId: org.id },
                'Error generating compliance items for asset'
              )
            }
          }
        }
      } catch (error) {
        totalErrors++
        logger.error({ error, orgId: org.id }, 'Error generating compliance items for org')
      }
    }

    logger.info(
      {
        total_orgs: orgs.length,
        total_created: totalCreated,
        total_skipped: totalSkipped,
        total_errors: totalErrors,
        periods_ahead: periodsAhead,
        duration_ms: Date.now() - start,
        correlation_id: 'cron:generate-compliance-items',
      },
      'Compliance item generation run complete'
    )
  } catch (error) {
    logger.error({ error, duration_ms: Date.now() - start }, 'Compliance item generation cron failed')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Compliance item generation cron failed:', e)
  process.exit(1)
})

