/**
 * Push double-entry bookkeeping balance fix migrations to Supabase
 * Usage: npx tsx scripts/push-migrations.ts
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

async function pushMigrations() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase credentials. Please set:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\n💡 These should be in your .env.local file');
    process.exit(1);
  }

  console.log('🚀 Pushing migrations to Supabase...\n');
  console.log(`📍 URL: ${supabaseUrl}\n`);

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  for (let i = 0; i < migrations.length; i++) {
    const migrationFile = migrations[i];
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile);

    try {
      console.log(`📄 Migration ${i + 1}/${migrations.length}: ${migrationFile}`);
      const sql = readFileSync(migrationPath, 'utf-8');

      // Execute SQL using RPC call to exec_sql if available, otherwise use direct query
      // Note: Supabase doesn't have a built-in exec_sql function, so we'll need to use
      // the REST API's query endpoint or split into individual statements

      // Split SQL into individual statements
      const statements = sql
        .split(/;\s*(?=\w)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.match(/^(begin|commit|--)/i));

      // For functions and complex statements, we need to execute the whole block
      // Let's try executing the entire migration as one query
      try {
        // Use the REST API to execute SQL
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ sql }),
        });

        if (!response.ok) {
          // If exec_sql doesn't exist, try using pg REST API or direct connection
          // For now, we'll need to use Supabase Dashboard or CLI
          throw new Error('exec_sql function not available');
        }

        const result = await response.json();
        console.log(`   ✅ Applied successfully\n`);
      } catch (error: any) {
        // Fallback: Try using Supabase Management API or provide instructions
        console.log(`   ⚠️  Cannot execute automatically: ${error.message}`);
        console.log(`   📋 Please apply manually using Supabase Dashboard SQL Editor`);
        console.log(`   📁 File: ${migrationPath}\n`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(`   ❌ Migration file not found: ${migrationPath}`);
        process.exit(1);
      } else {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }
  }

  console.log('✅ Migration push completed!');
  console.log('\n📋 Verification:');
  console.log('Run this query in Supabase Dashboard to verify:');
  console.log('SELECT COUNT(*) FROM transaction_lines WHERE account_entity_type IS NULL;');
  console.log('(Should return 0)\n');
}

pushMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
