/**
 * Push migrations using existing Supabase credentials
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing credentials');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? '✓' : '✗');
  process.exit(1);
}

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

async function pushMigrations() {
  console.log('🚀 Pushing migrations to Supabase...\n');
  console.log(`📍 URL: ${supabaseUrl.substring(0, 30)}...\n`);

  // Use pg client for direct SQL execution
  const { Client } = await import('pg');
  
  // Construct database URL from Supabase URL
  // Supabase projects have a direct Postgres connection
  // Format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
  
  // Try to get direct DB URL or construct from service key
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  
  if (!dbUrl) {
    // Extract project ref from Supabase URL and try to construct connection
    const projectMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
    if (projectMatch) {
      const projectRef = projectMatch[1];
      console.log(`📋 Found project ref: ${projectRef}`);
      console.log(`💡 Need DATABASE_URL or SUPABASE_DB_URL to connect directly`);
      console.log(`   You can find it in Supabase Dashboard > Settings > Database > Connection string\n`);
    }
    
    // Alternative: Use Supabase Management API to execute migrations
    console.log('🔄 Trying alternative method: Supabase CLI...\n');
    
    // Try using Supabase CLI with project ref
    const { execSync } = await import('child_process');
    try {
      const projectRef = projectMatch?.[1];
      if (projectRef) {
        console.log(`📡 Attempting to push via CLI with project ref...`);
        const output = execSync(`npx supabase db push --project-ref ${projectRef} --yes`, {
          encoding: 'utf-8',
          stdio: 'inherit',
          cwd: process.cwd(),
        });
        console.log(output);
        console.log('✅ Migrations pushed!\n');
        return;
      }
    } catch (error: any) {
      console.log(`   ⚠️  CLI method failed: ${error.message}\n`);
    }
    
    console.log('❌ Cannot execute migrations automatically without DATABASE_URL');
    console.log('📋 Please apply manually using MIGRATIONS_TO_APPLY.sql\n');
    return;
  }

  // Execute migrations using pg client
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
        if (
          err.message.includes('already exists') ||
          err.message.includes('duplicate key') ||
          err.message.includes('constraint') && err.message.includes('already')
        ) {
          console.log(`   ⚠️  ${err.message.split('\n')[0]} (skipping)\n`);
        } else {
          console.error(`   ❌ Error: ${err.message}`);
          throw err;
        }
      }
    }
    
    console.log('✅ All migrations applied successfully!\n');
    
    // Verify
    const result = await client.query(
      'SELECT COUNT(*) as count FROM transaction_lines WHERE account_entity_type IS NULL'
    );
    const nullCount = parseInt(result.rows[0].count);
    if (nullCount === 0) {
      console.log('✅ Verification passed: All transaction_lines have account_entity_type set\n');
    } else {
      console.log(`⚠️  Warning: ${nullCount} transaction_lines still have NULL account_entity_type\n`);
    }
    
  } catch (error: any) {
    console.error('❌ Error executing migrations:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

pushMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
