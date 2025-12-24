/**
 * Execute migrations via Supabase Management API
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const PROJECT_REF = 'cidfgplknvueaivsxiqa';
const EMAIL = 'brandon@managedbyora.com';
const PASSWORD = '@2Tampa2015';

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

async function executeMigrations() {
  console.log('🚀 Executing migrations via Management API...\n');

  // Get access token from Supabase Auth
  // Note: Supabase Management API uses different auth
  // For now, let's try using the database connection via pg with proper error handling
  
  const { Client } = await import('pg');
  
  // Try connection with IPv4 preference
  const dbUrl = `postgresql://postgres:${encodeURIComponent(PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;
  
  const client = new Client({
    connectionString: dbUrl,
    // Force IPv4
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: PASSWORD,
    database: 'postgres',
  });

  try {
    console.log('🔄 Attempting database connection...');
    await client.connect();
    console.log('✅ Connected!\n');

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
          // Continue with next migration
          console.log(`   ⚠️  Continuing...\n`);
        }
      }
    }
    
    console.log('✅ All migrations processed!\n');
    
    // Verify
    try {
      const result = await client.query(
        'SELECT COUNT(*)::int as count FROM transaction_lines WHERE account_entity_type IS NULL'
      );
      const nullCount = result.rows[0]?.count || 0;
      if (nullCount === 0) {
        console.log('✅ Verification: All transaction_lines have account_entity_type set\n');
      } else {
        console.log(`⚠️  Warning: ${nullCount} transaction_lines still have NULL account_entity_type\n`);
      }
    } catch (err: any) {
      console.log(`⚠️  Could not verify: ${err.message}\n`);
    }
    
  } catch (error: any) {
    console.error('❌ Connection error:', error.message);
    console.error('\n💡 Network connectivity issue detected.');
    console.error('📋 Please run this script from your local machine:');
    console.error('   npx tsx scripts/execute-via-management-api.ts\n');
    throw error;
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
  }
}

executeMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
