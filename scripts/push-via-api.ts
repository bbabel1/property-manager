/**
 * Push migrations via Supabase Management API or direct SQL execution
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing credentials');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? '✓' : '✗');
  console.error('\n💡 These should be in .env.local file');
  process.exit(1);
}

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

async function pushMigrations() {
  console.log('🚀 Pushing migrations...\n');
  console.log(`📍 Supabase URL: ${supabaseUrl.substring(0, 40)}...\n`);

  // Extract project ref for CLI usage
  const projectMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  const projectRef = projectMatch?.[1];

  if (projectRef) {
    console.log(`📋 Found project ref: ${projectRef}\n`);
    console.log('🔄 Attempting to push via Supabase CLI...\n');
    
    const { execSync } = await import('child_process');
    try {
      // Try pushing with project ref
      execSync(`npx supabase db push --project-ref ${projectRef} --yes`, {
        encoding: 'utf-8',
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('\n✅ Migrations pushed successfully!\n');
      return;
    } catch (error: any) {
      console.log(`\n⚠️  CLI push failed. Error: ${error.message}\n`);
      console.log('📋 Trying alternative: Direct SQL execution...\n');
    }
  }

  // Alternative: Try direct SQL execution via pg
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  
  if (dbUrl) {
    console.log('🔄 Using direct database connection...\n');
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
            console.log(`   ⚠️  ${errMsg} (already applied, skipping)\n`);
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
      
      await client.end();
      return;
    } catch (error: any) {
      console.error('❌ Database connection error:', error.message);
      await client.end().catch(() => {});
    }
  }

  // Final fallback: Instructions
  console.log('❌ Cannot push migrations automatically\n');
  console.log('📋 Please apply manually:\n');
  console.log('1. Open: MIGRATIONS_TO_APPLY.sql');
  console.log('2. Go to: Supabase Dashboard > SQL Editor');
  console.log('3. Copy each migration section and run in order\n');
  console.log('Or link your project and try again:');
  console.log('   npx supabase login');
  console.log(`   npx supabase link --project-ref ${projectRef || 'YOUR_PROJECT_REF'}\n`);
}

pushMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
