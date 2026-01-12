 
#!/usr/bin/env node

/**
 * Deprecated: reconciliation_log schema is now managed exclusively via
 * Supabase migrations (see supabase/migrations/20250912000001_069_reconciliation_log_buildium.sql).
 *
 * Phase 1 goal is to eliminate schema drift by preventing ad-hoc schema changes.
 * This script no longer applies any DDL. It only prints guidance and exits
 * with a non-error status.
 */

/* eslint-disable no-console */

console.log(
  [
    'apply-reconciliation-log.js is deprecated.',
    '',
    'Reconciliation schema is managed only through migrations:',
    '  supabase/migrations/20250912000001_069_reconciliation_log_buildium.sql',
    '',
    'To update schema, add a new Supabase migration instead of using this script.',
  ].join('\n')
);
