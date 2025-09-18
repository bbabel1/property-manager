#!/usr/bin/env -S node --loader tsx
import 'dotenv/config'
import { generateRecurringCharges } from '../../src/lib/recurring-engine'
import { logger } from '../../src/lib/logger'

async function main() {
  if (process.env.ENABLE_RECURRING === '0' || process.env.ENABLE_RECURRING === 'false') {
    console.log('Recurring engine disabled via ENABLE_RECURRING')
    return
  }
  if ((process.env.TZ || '').toLowerCase() !== 'america/new_york') {
    console.warn('Warning: TZ is not America/New_York; set TZ=America/New_York for correct schedule semantics')
  }
  const start = Date.now()
  const { created } = await generateRecurringCharges(60)
  logger.info({ created, duration_ms: Date.now() - start, correlation_id: 'cron:recurring' }, 'Recurring engine run complete')
}

main().catch((e) => {
  console.error('Recurring engine failed:', e)
  process.exit(1)
})
