/**
 * Automatically push migrations to Supabase
 * Tries multiple methods: CLI linked, direct DB connection, or Management API
 * Usage: npx tsx scripts/push-migrations-auto.ts
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

config({ path: '.env.local' });

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

async function pushMigrations() {
  console.log('🚀 Attempting to push migrations...\n');

  // Method 1: Try Supabase CLI linked project
  try {
    console.log('📡 Method 1: Trying Supabase CLI (linked project)...');
    const output = execSync('npx supabase db push --linked --yes', {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: process.cwd(),
    });
    console.log(output);
    console.log('✅ Migrations pushed successfully via CLI!\n');
    return;
  } catch (error: any) {
    if (error.message.includes('not linked') || error.message.includes('project ref')) {
      console.log('   ⚠️  Project not linked. Trying next method...\n');
    } else {
      console.log(`   ⚠️  CLI error: ${error.message}\n`);
    }
  }

  // Method 2: Try with project ref from environment
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (projectRef) {
    try {
      console.log(`📡 Method 2: Trying with project ref: ${projectRef}...`);
      const output = execSync(`npx supabase db push --project-ref ${projectRef} --yes`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        cwd: process.cwd(),
      });
      console.log(output);
      console.log('✅ Migrations pushed successfully!\n');
      return;
    } catch (error: any) {
      console.log(`   ⚠️  Error: ${error.message}\n`);
    }
  }

  // Method 3: Try direct database connection
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (dbUrl) {
    try {
      console.log('📡 Method 3: Trying direct database connection...');
      const encodedUrl = encodeURIComponent(dbUrl);
      const output = execSync(`npx supabase db push --db-url "${encodedUrl}" --yes`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        cwd: process.cwd(),
      });
      console.log(output);
      console.log('✅ Migrations pushed successfully!\n');
      return;
    } catch (error: any) {
      console.log(`   ⚠️  Error: ${error.message}\n`);
    }
  }

  // If all methods fail, provide instructions
  console.log('❌ Could not push migrations automatically.\n');
  console.log('📋 Manual Application Required:\n');
  console.log('Option A: Link Supabase project and push:');
  console.log('   1. npx supabase login');
  console.log('   2. npx supabase link --project-ref YOUR_PROJECT_REF');
  console.log('   3. npx supabase db push\n');
  console.log('Option B: Use Supabase Dashboard:');
  console.log('   1. Open MIGRATIONS_TO_APPLY.sql');
  console.log('   2. Go to Supabase Dashboard > SQL Editor');
  console.log('   3. Copy and paste each migration section');
  console.log('   4. Run each migration in order\n');
  console.log('Option C: Provide database connection:');
  console.log('   Set DATABASE_URL or SUPABASE_DB_URL in .env.local');
  console.log('   Then run this script again\n');
}

pushMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
