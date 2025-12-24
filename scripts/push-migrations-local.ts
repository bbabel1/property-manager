/**
 * Push migrations - Run this from your local machine with network access
 * Usage: npx tsx scripts/push-migrations-local.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const PROJECT_REF = 'cidfgplknvueaivsxiqa';
const DB_PASSWORD = '@2Tampa2015';

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

async function pushMigrations() {
  console.log('🚀 Pushing migrations to Supabase...\n');
  console.log(`📍 Project: ${PROJECT_REF}\n`);

  // Use direct database connection
  const dbUrl = `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
  
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
          (errMsg.includes('constraint') && errMsg.includes('already')) ||
          errMsg.includes('relation') && errMsg.includes('already')
        ) {
          console.log(`   ⚠️  ${errMsg} (already applied, skipping)\n`);
        } else {
          console.error(`   ❌ Error: ${errMsg}`);
          throw err;
        }
      }
    }
    
    console.log('✅ All migrations applied successfully!\n');
    
    // Verify
    const result = await client.query(
      'SELECT COUNT(*)::int as count FROM transaction_lines WHERE account_entity_type IS NULL'
    );
    const nullCount = result.rows[0]?.count || 0;
    if (nullCount === 0) {
      console.log('✅ Verification passed: All transaction_lines have account_entity_type set\n');
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

pushMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
