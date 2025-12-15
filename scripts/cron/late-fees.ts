#!/usr/bin/env -S node --loader tsx
import 'dotenv/config'
import { postLateFees } from '@/lib/recurring-engine'
import { logger } from '@/lib/logger'

async function main() {
  if (process.env.ENABLE_LATE_FEES === '0' || process.env.ENABLE_LATE_FEES === 'false') {
    console.log('Late fees cron disabled via ENABLE_LATE_FEES')
    return
  }
  if ((process.env.TZ || '').toLowerCase() !== 'america/new_york') {
    console.warn('Warning: TZ is not America/New_York; set TZ=America/New_York for correct timing')
  }
  const start = Date.now()
  const { created } = await postLateFees()
  logger.info({ created, duration_ms: Date.now() - start, correlation_id: 'cron:latefees' }, 'Late fees run complete')
}

main().catch((e) => {
  console.error('Late fees cron failed:', e)
  process.exit(1)
})
