/**
 * Execute migrations using the existing Supabase setup
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'fs';
import { join } from 'path';

// Will use pg client for direct SQL execution

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

async function executeMigrations() {
  console.log('🚀 Executing migrations...\n');

  // Get database URL from environment or construct from Supabase URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
    process.exit(1);
  }

  if (!dbUrl) {
    console.log('⚠️  DATABASE_URL not found. Trying to use Supabase CLI...\n');
    
    // Extract project ref and try CLI
    const projectMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (projectMatch) {
      const projectRef = projectMatch[1];
      console.log(`📡 Found project ref: ${projectRef}`);
      console.log(`🔄 Attempting to push via Supabase CLI...\n`);
      
      const { execSync } = await import('child_process');
      try {
        execSync(`npx supabase db push --project-ref ${projectRef} --yes`, {
          encoding: 'utf-8',
          stdio: 'inherit',
          cwd: process.cwd(),
        });
        console.log('\n✅ Migrations pushed successfully!\n');
        return;
      } catch (error: any) {
        console.log(`\n⚠️  CLI push failed: ${error.message}`);
        console.log('📋 Please apply migrations manually using MIGRATIONS_TO_APPLY.sql\n');
        return;
      }
    }
    
    console.log('❌ Cannot execute without DATABASE_URL');
    console.log('📋 Please apply manually using MIGRATIONS_TO_APPLY.sql\n');
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
          console.log(`   ⚠️  ${errMsg} (skipping - already applied)\n`);
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

executeMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
