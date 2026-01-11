#!/usr/bin/env -S node --loader tsx
import 'dotenv/config'
import { generateRecurringBills } from '@/lib/recurring-bills-engine'
import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/db'

async function main() {
  if (process.env.ENABLE_RECURRING_BILLS === '0' || process.env.ENABLE_RECURRING_BILLS === 'false') {
    console.log('Recurring bills engine disabled via ENABLE_RECURRING_BILLS')
    return
  }
  if ((process.env.TZ || '').toLowerCase() !== 'america/new_york') {
    console.warn('Warning: TZ is not America/New_York; set TZ=America/New_York for correct schedule semantics')
  }

  // Acquire advisory lock to prevent concurrent runs
  // Use PostgreSQL's pg_try_advisory_lock with a bigint key (hashtext of lock key)
  const lockKey = 'recurring-bills-generation'
  let lockAcquired = false

  try {
    // Use advisory lock helper function (created in migration)
    const { data, error } = await supabaseAdmin.rpc('acquire_recurring_bills_lock', {
      lock_key: lockKey,
    })

    if (error) {
      // Function may not exist in all environments - log warning and continue
      logger.warn({ error }, 'Advisory lock function not available, continuing anyway (idempotency_key prevents duplicates)')
      lockAcquired = true
    } else if (data === false) {
      logger.warn({ lockKey }, 'Advisory lock already held by another process, skipping run')
      return
    } else {
      lockAcquired = true
      logger.info({ lockKey }, 'Acquired advisory lock')
    }
  } catch (error) {
    // If advisory lock mechanism fails entirely, log warning but continue
    // Idempotency keys will prevent duplicate generation
    logger.warn({ error }, 'Could not acquire advisory lock, continuing anyway (idempotency_key prevents duplicates)')
    lockAcquired = true
  }

  try {
    const start = Date.now()
    const horizon = Number.parseInt(process.env.RECURRING_BILLS_HORIZON_DAYS || '60', 10)
    const result = await generateRecurringBills(horizon)

    logger.info(
      {
        generated: result.generated,
        skipped: result.skipped,
        duplicates: result.duplicates,
        errors: result.errors,
        orgIds: result.orgIds,
        duration_ms: Date.now() - start,
        correlation_id: 'cron:recurring-bills',
      },
      'Recurring bills engine run complete',
    )
  } finally {
    // Release advisory lock if we acquired it
    if (lockAcquired) {
      try {
        await supabaseAdmin.rpc('release_recurring_bills_lock', {
          lock_key: lockKey,
        })
        logger.info({ lockKey }, 'Released advisory lock')
      } catch (error) {
        logger.warn({ error }, 'Could not release advisory lock (non-critical)')
      }
    }
  }
}

main().catch((e) => {
  console.error('Recurring bills engine failed:', e)
  process.exit(1)
})

