#!/usr/bin/env tsx
/**
 * Verifies that:
 * - RLS is enabled on public.transaction_payment_transactions
 * - Expected policies exist
 * - Expected indexes exist
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD from `.env`.
 */
import { Client } from 'pg';
import { config } from 'dotenv';
import { z } from 'zod';

config({ path: '.env' });

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  SUPABASE_DB_PASSWORD: z.string().min(1),
});

function projectRefFromUrl(url: string): string {
  const ref = url.match(/https?:\/\/([^.]+)\./)?.[1];
  if (!ref) throw new Error('Could not parse Supabase project ref from NEXT_PUBLIC_SUPABASE_URL');
  return ref;
}

async function main() {
  const env = EnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_DB_PASSWORD: process.env.SUPABASE_DB_PASSWORD,
  });

  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const host = `db.${ref}.supabase.co`;

  const client = new Client({
    host,
    port: 5432,
    user: 'postgres',
    password: env.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    const rlsRes = await client.query<{
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(
      `SELECT c.relrowsecurity, c.relforcerowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname='public' AND c.relname='transaction_payment_transactions'`,
    );
    console.log('RLS flags:', rlsRes.rows[0] ?? null);

    const policies = await client.query<{
      policyname: string;
      cmd: string;
      qual: string | null;
      with_check: string | null;
    }>(
      `SELECT policyname, cmd, qual, with_check
       FROM pg_policies
       WHERE schemaname='public' AND tablename='transaction_payment_transactions'
       ORDER BY policyname`,
    );
    console.log('\nPolicies on transaction_payment_transactions:');
    console.table(policies.rows);

    const indexes = await client.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname='public'
         AND (
           (tablename='transaction_payment_transactions' AND indexname='ux_transaction_payment_transactions_tx_payment')
           OR
           (tablename='transactions' AND indexname='idx_transactions_bank_gl_account_buildium_id')
         )
       ORDER BY tablename, indexname`,
    );
    console.log('\nExpected indexes:');
    console.table(indexes.rows);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Fatal:', (err as any)?.message || err);
  process.exit(1);
});


