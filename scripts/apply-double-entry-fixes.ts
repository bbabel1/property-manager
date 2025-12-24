/**
 * Apply double-entry bookkeeping balance fix migrations
 * Usage: npx tsx scripts/apply-double-entry-fixes.ts
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { supabaseAdmin } from '@/lib/db';

config({ path: '.env.local' });

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

async function applyMigrations() {
  console.log('🚀 Applying double-entry bookkeeping balance fix migrations...\n');

  for (const migrationFile of migrations) {
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile);
    
    try {
      console.log(`📄 Reading migration: ${migrationFile}`);
      const sql = readFileSync(migrationPath, 'utf-8');
      
      // Split by semicolons and filter out empty statements
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

      console.log(`   Executing ${statements.length} statement(s)...`);

      // Execute each statement
      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabaseAdmin.rpc('exec_sql', {
            sql: statement + ';',
          });

          // If exec_sql doesn't exist, try direct query execution
          if (error && error.message.includes('exec_sql')) {
            // Use raw query execution via pg client if available
            // For now, we'll need to use the Supabase SQL editor or manual execution
            console.log(`   ⚠️  Cannot execute SQL directly. Please apply this migration manually:`);
            console.log(`   File: ${migrationPath}`);
            console.log(`   Or use Supabase Dashboard SQL Editor`);
            continue;
          }

          if (error) {
            // Some errors are expected (e.g., "already exists")
            if (
              error.message.includes('already exists') ||
              error.message.includes('does not exist') ||
              error.message.includes('duplicate')
            ) {
              console.log(`   ⚠️  ${error.message} (continuing...)`);
            } else {
              throw error;
            }
          }
        }
      }

      console.log(`   ✅ Migration ${migrationFile} applied successfully\n`);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(`   ❌ Migration file not found: ${migrationPath}`);
        process.exit(1);
      } else {
        console.error(`   ❌ Error applying migration ${migrationFile}:`, error.message);
        console.error(`   Please apply this migration manually using Supabase Dashboard SQL Editor`);
        console.error(`   File: ${migrationPath}\n`);
        // Continue with next migration
      }
    }
  }

  console.log('✅ All migrations processed!');
  console.log('\n📋 Next steps:');
  console.log('1. Verify migrations were applied: Check Supabase Dashboard > Database > Migrations');
  console.log('2. Run diagnostic script: npx tsx scripts/diagnostics/check-double-entry-balance-issues.ts');
  console.log('3. Test property cash balances to ensure they only include Rental transactions');
}

// Alternative: Execute SQL directly using pg if available
async function applyMigrationsDirect() {
  console.log('🚀 Applying migrations using direct SQL execution...\n');

  const { createClient } = await import('@supabase/supabase-js');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase credentials. Please set:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\n💡 These should be in your .env.local file');
    process.exit(1);
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  for (const migrationFile of migrations) {
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile);
    
    try {
      console.log(`📄 Applying migration: ${migrationFile}`);
      const sql = readFileSync(migrationPath, 'utf-8');
      
      // Execute the entire migration as a single query
      // Note: Supabase JS client doesn't support multi-statement SQL directly
      // We'll need to split and execute statements individually
      const statements = sql
        .split(/;\s*(?=\w)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--') && !s.match(/^\/\*/));

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement && !statement.match(/^(begin|commit|--)/i)) {
          try {
            // Try to execute via RPC if we have a helper function
            // Otherwise, we'll need manual application
            const { error } = await adminClient.rpc('exec_sql', { sql: statement });
            
            if (error) {
              // If exec_sql doesn't exist, we need manual application
              if (error.message.includes('exec_sql') || error.message.includes('function')) {
                console.log(`\n   ⚠️  Cannot execute SQL automatically.`);
                console.log(`   Please apply this migration manually:`);
                console.log(`   📁 File: ${migrationPath}`);
                console.log(`   📋 Copy the SQL content and run it in Supabase Dashboard > SQL Editor\n`);
                break;
              }
              throw error;
            }
          } catch (err: any) {
            console.log(`\n   ⚠️  Cannot execute SQL automatically: ${err.message}`);
            console.log(`   Please apply this migration manually:`);
            console.log(`   📁 File: ${migrationPath}`);
            console.log(`   📋 Copy the SQL content and run it in Supabase Dashboard > SQL Editor\n`);
            break;
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(`   ❌ Migration file not found: ${migrationPath}`);
      } else {
        console.error(`   ❌ Error: ${error.message}`);
      }
    }
  }

  console.log('\n✅ Migration script completed!');
  console.log('\n📋 Manual Application Required:');
  console.log('Since Supabase JS client cannot execute multi-statement SQL directly,');
  console.log('please apply these migrations manually:');
  console.log('');
  migrations.forEach((file) => {
    console.log(`   1. Open: supabase/migrations/${file}`);
    console.log(`   2. Copy the SQL content`);
    console.log(`   3. Run in Supabase Dashboard > SQL Editor`);
    console.log('');
  });
}

// Run the script
applyMigrationsDirect().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
