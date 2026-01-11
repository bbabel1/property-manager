#!/usr/bin/env tsx
import { Client } from 'pg';

/**
 * Fail the build if sensitive tables still have permissive RLS policies.
 *
 * A policy is flagged when its USING or WITH CHECK expression is literally `true`
 * (ignoring whitespace/casing), which effectively makes the policy allow-all.
 */
const SENSITIVE_TABLES = [
  'properties',
  'units',
  'ownerships',
  'transactions',
  'transaction_lines',
  'gl_accounts',
  'property_staff',
  'service_plan_assignments',
  'property_ownerships_cache',
];

const normalizeExpr = (value: string | null): string =>
  (value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();

async function main() {
  const connectionString =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.PG_CONN_STRING ||
    '';

  if (!connectionString) {
    console.error(
      'Missing database connection string. Set SUPABASE_DB_URL, DATABASE_URL, or PG_CONN_STRING.',
    );
    process.exit(1);
  }

  const client = new Client({ connectionString, application_name: 'rls-audit' });
  await client.connect();

  try {
    const { rows } = await client.query<{
      schemaname: string;
      tablename: string;
      polname: string;
      cmd: string;
      usingdef: string | null;
      checkdef: string | null;
    }>(
      `
        SELECT
          schemaname,
          tablename,
          polname,
          cmd,
          pg_get_expr(qual, tableoid)  AS usingdef,
          pg_get_expr(with_check, tableoid) AS checkdef
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ANY($1::text[])
        ORDER BY tablename, polname, cmd;
      `,
      [SENSITIVE_TABLES],
    );

    const violations = rows.filter((row) => {
      const usingNorm = normalizeExpr(row.usingdef);
      const checkNorm = normalizeExpr(row.checkdef);
      return usingNorm === 'true' || checkNorm === 'true';
    });

    if (violations.length) {
      console.error('Found permissive RLS policies on sensitive tables:');
      for (const v of violations) {
        console.error(
          `- ${v.tablename}.${v.polname} (${v.cmd}): USING="${v.usingdef ?? ''}" WITH CHECK="${
            v.checkdef ?? ''
          }"`,
        );
      }
      process.exit(1);
    }

    console.log('RLS audit passed: no allow-all policies detected on sensitive tables.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('RLS audit failed:', error);
  process.exit(1);
});
