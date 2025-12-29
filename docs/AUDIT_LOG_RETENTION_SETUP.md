# Audit Log Retention - External Cron Setup

**Date**: 2025-01-31  
**Purpose**: Set up weekly cleanup of audit/log tables since pg_cron extension is not available

---

## Overview

The `cleanup_audit_logs()` function has been created in the database to automatically clean up old audit log entries. Since the `pg_cron` extension is not available, we need to set up an external cron job to call this function weekly.

---

## Retention Policies

The cleanup function implements the following retention policies:

- **`buildium_api_log`**: Keep 90 days, remove older entries
- **`buildium_integration_audit_log`**: Keep 90 days, remove older entries
- **`buildium_webhook_events`**: Keep processed events for 30 days, remove older processed entries

---

## Setup Options

### Option 1: Supabase Edge Function (Recommended)

Create a Supabase Edge Function that calls the cleanup function, then schedule it via external cron or Supabase's scheduled functions (if available).

**File**: `supabase/functions/cleanup-audit-logs/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const { data, error } = await supabase.rpc('cleanup_audit_logs')
  
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

**Schedule via external cron** (e.g., GitHub Actions, Vercel Cron, or server cron):

```yaml
# .github/workflows/cleanup-audit-logs.yml
name: Cleanup Audit Logs
on:
  schedule:
    - cron: '0 2 * * 0'  # Every Sunday at 2 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Call cleanup function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            "${{ secrets.SUPABASE_URL }}/functions/v1/cleanup-audit-logs"
```

### Option 2: Direct Database Connection (Server Cron)

If you have a server with direct database access, set up a cron job:

**Script**: `scripts/cron/cleanup-audit-logs.ts`

```typescript
#!/usr/bin/env tsx
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const start = Date.now()
  const { data, error } = await supabase.rpc('cleanup_audit_logs')
  
  if (error) {
    logger.error({ error, duration_ms: Date.now() - start }, 'Audit log cleanup failed')
    process.exit(1)
  }
  
  logger.info({ duration_ms: Date.now() - start }, 'Audit log cleanup completed')
}

main().catch((e) => {
  console.error('Cleanup failed:', e)
  process.exit(1)
})
```

**Cron entry** (on server):

```bash
# Run every Sunday at 2 AM
0 2 * * 0 cd /path/to/property-manager && /usr/bin/tsx scripts/cron/cleanup-audit-logs.ts >> /var/log/audit-cleanup.log 2>&1
```

### Option 3: Vercel Cron (If using Vercel)

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-audit-logs",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

Create `src/app/api/cron/cleanup-audit-logs/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function GET(req: Request) {
  // Verify cron secret if needed
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const start = Date.now()
    const { data, error } = await supabaseAdmin.rpc('cleanup_audit_logs')
    
    if (error) {
      logger.error({ error, duration_ms: Date.now() - start }, 'Audit log cleanup failed')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    logger.info({ duration_ms: Date.now() - start }, 'Audit log cleanup completed')
    return NextResponse.json({ success: true, data })
  } catch (e) {
    logger.error({ error: e }, 'Audit log cleanup exception')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

---

## Manual Testing

Test the cleanup function manually:

```sql
-- Check current row counts
SELECT 
  'buildium_api_log' AS table_name,
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') AS rows_to_delete
FROM buildium_api_log
UNION ALL
SELECT 
  'buildium_integration_audit_log',
  COUNT(*),
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days')
FROM buildium_integration_audit_log
UNION ALL
SELECT 
  'buildium_webhook_events',
  COUNT(*),
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL AND processed_at < NOW() - INTERVAL '30 days')
FROM buildium_webhook_events;

-- Run cleanup
SELECT cleanup_audit_logs();

-- Verify rows were deleted (run the first query again)
```

---

## Monitoring

After setting up the cron job, monitor for:

1. **Execution logs**: Check that the cron job runs successfully each week
2. **Row counts**: Verify that old rows are being deleted
3. **Error handling**: Ensure errors are logged and alerted

**Query to monitor retention**:

```sql
-- Check retention status
SELECT 
  'buildium_api_log' AS table_name,
  COUNT(*) AS total_rows,
  MIN(created_at) AS oldest_entry,
  MAX(created_at) AS newest_entry,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') AS rows_older_than_90_days
FROM buildium_api_log
UNION ALL
SELECT 
  'buildium_integration_audit_log',
  COUNT(*),
  MIN(created_at),
  MAX(created_at),
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days')
FROM buildium_integration_audit_log
UNION ALL
SELECT 
  'buildium_webhook_events',
  COUNT(*),
  MIN(processed_at),
  MAX(processed_at),
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL AND processed_at < NOW() - INTERVAL '30 days')
FROM buildium_webhook_events;
```

---

## Troubleshooting

### Function not found
- Verify migration `20291225000002_audit_log_retention_policies.sql` was applied
- Check function exists: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'cleanup_audit_logs';`

### No rows deleted
- Check if tables have old rows: Run the monitoring query above
- Verify retention intervals are correct
- Check function logs for errors

### Cron job not running
- Verify cron schedule is correct
- Check cron job logs
- Test manual execution first

---

## Next Steps

1. Choose a setup option based on your infrastructure
2. Set up the cron job
3. Test manually first
4. Monitor for the first week to confirm it's working
5. Set up alerts for failures

---

**Last Updated**: 2025-01-31

