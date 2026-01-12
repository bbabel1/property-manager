#!/usr/bin/env node

/**
 * Deprecated schema apply helper.
 *
 * Original intent: help apply “missing” migrations or schema deltas directly.
 * Phase 1 goal: only Supabase migrations may mutate schema; no ad-hoc apply-*.
 *
 * This script now acts as a read-only helper that reminds you to use:
 *
 *   - `supabase db diff --linked --schema public`   (to detect drift)
 *   - `supabase db push --linked`                  (to apply migrations)
 *
 * It does NOT execute any DDL.
 */

/* eslint-disable no-console */

console.log(
  [
    'apply-missing-migrations.js is deprecated.',
    '',
    'Schema changes must go through Supabase migrations only.',
    '',
    'To audit for drift, run (from repo root):',
    '  npx supabase@latest db diff --linked --schema public',
    '',
    'To apply migrations to a linked project, run:',
    '  npx supabase@latest db push --linked',
  ].join('\n')
);
