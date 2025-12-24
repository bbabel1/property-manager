/**
 * Apply migrations using existing Supabase admin client
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'fs';
import { join } from 'path';
import { supabaseAdmin } from '@/lib/db';

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

async function applyMigrations() {
  console.log('🚀 Applying migrations using Supabase admin client...\n');

  // Use pg client for direct SQL execution
  // We need the database connection string
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
  }

  if (!dbUrl) {
    console.log('⚠️  DATABASE_URL not found. Using Supabase REST API approach...\n');
    
    // Try to execute via RPC if we have a helper function
    // Otherwise, we'll need to use pg with connection string
    console.log('💡 To execute migrations automatically, you need:');
    console.log('   1. DATABASE_URL or SUPABASE_DB_URL in .env.local');
    console.log('   2. Or apply manually using MIGRATIONS_TO_APPLY.sql\n');
    
    // Try using Supabase CLI as fallback
    try {
      const { execSync } = await import('child_process');
      const projectMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
      if (projectMatch) {
        const projectRef = projectMatch[1];
        console.log(`📡 Attempting via Supabase CLI with project ref: ${projectRef}\n`);
        execSync(`npx supabase db push --project-ref ${projectRef} --yes`, {
          encoding: 'utf-8',
          stdio: 'inherit',
          cwd: process.cwd(),
        });
        console.log('\n✅ Migrations pushed successfully!\n');
        return;
      }
    } catch (error: any) {
      console.log(`\n⚠️  CLI method failed. Please apply migrations manually.\n`);
    }
    
    return;
  }

  // Execute using pg client
  const { Client } = await import('pg');
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    for (let i = 0; i < migrations.length; i++) {
      const migrationFile = migrations[i];
      const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile);
      
      console.log(`📄 Migration ${i + 1}/${migrations.length}: ${migrationFile}`);
      const sql = readFileSync(migrationPath, 'utf-8');
      
      try {
        await client.query(sql);
        console.log(`   ✅ Applied successfully\n`);
      } catch (err: any) {
        const errMsg = err.message.split('\n')[0];
        if (
          errMsg.includes('already exists') ||
          errMsg.includes('duplicate') ||
          (errMsg.includes('constraint') && errMsg.includes('already'))
        ) {
          console.log(`   ⚠️  ${errMsg} (skipping)\n`);
        } else {
          console.error(`   ❌ Error: ${errMsg}`);
          throw err;
        }
      }
    }
    
    console.log('✅ All migrations applied!\n');
    
    // Verify
    const result = await client.query(
      'SELECT COUNT(*)::int as count FROM transaction_lines WHERE account_entity_type IS NULL'
    );
    const nullCount = result.rows[0]?.count || 0;
    if (nullCount === 0) {
      console.log('✅ Verification: All transaction_lines have account_entity_type set\n');
    } else {
      console.log(`⚠️  Warning: ${nullCount} transaction_lines still have NULL account_entity_type\n`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

applyMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
