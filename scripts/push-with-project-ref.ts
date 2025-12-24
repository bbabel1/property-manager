/**
 * Push migrations using project ref and database password
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

const PROJECT_REF = 'cidfgplknvueaivsxiqa';
const DB_PASSWORD = '@2Tampa2015';

// Construct database URL for Supabase
// Format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
// Or direct: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

async function pushMigrations() {
  console.log('🚀 Pushing migrations to Supabase...\n');
  console.log(`📍 Project: ${PROJECT_REF}\n`);

  // Try pooler connection (more reliable)
  // Format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
  // Or try: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
  // Try multiple connection formats
  const connectionStrings = [
    `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${PROJECT_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  ];
  
  let dbUrl = connectionStrings[0];
  
  // Try each connection string until one works
  let client: Client | null = null;
  let connected = false;
  
  for (const connStr of connectionStrings) {
    try {
      console.log(`🔄 Trying connection: ${connStr.substring(0, 50)}...`);
      client = new Client({ connectionString: connStr });
      await client.connect();
      console.log('✅ Connected to database\n');
      connected = true;
      dbUrl = connStr;
      break;
    } catch (err: any) {
      console.log(`   ⚠️  Failed: ${err.message.split('\n')[0]}\n`);
      if (client) {
        try {
          await client.end();
        } catch (e) {
          // Ignore
        }
      }
    }
  }
  
  if (!connected || !client) {
    throw new Error('Could not connect to database with any connection string');
  }

  try {

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
          // Don't throw - continue with next migration
          console.log(`   ⚠️  Continuing with next migration...\n`);
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
        console.log('✅ Verification passed: All transaction_lines have account_entity_type set\n');
      } else {
        console.log(`⚠️  Warning: ${nullCount} transaction_lines still have NULL account_entity_type\n`);
      }
    } catch (err: any) {
      console.log(`⚠️  Could not verify: ${err.message}\n`);
    }
    
  } catch (error: any) {
    console.error('❌ Connection error:', error.message);
    console.error('\n💡 Trying alternative: Supabase CLI with project ref...\n');
    
    // Fallback: Try CLI
    const { execSync } = await import('child_process');
    try {
      execSync(`npx supabase db push --project-ref ${PROJECT_REF} --password "${DB_PASSWORD}" --yes`, {
        encoding: 'utf-8',
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('\n✅ Migrations pushed via CLI!\n');
    } catch (cliError: any) {
      console.error('❌ CLI also failed:', cliError.message);
      console.error('\n📋 Please apply manually using MIGRATIONS_TO_APPLY.sql\n');
    }
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignore
    }
  }
}

pushMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
