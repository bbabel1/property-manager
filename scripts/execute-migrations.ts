/**
 * Execute migrations directly using Supabase service role
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from multiple possible locations
config({ path: '.env.local' });
config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nCurrent env vars:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', serviceKey ? 'SET' : 'NOT SET');
  process.exit(1);
}

const migrations = [
  '20250108000000_backfill_account_entity_type.sql',
  '20250108000001_fix_balance_entity_type_filtering.sql',
  '20250108000002_fix_get_property_financials_entity_type.sql',
  '20250108000003_fix_v_gl_account_balances_entity_type.sql',
];

async function executeMigrations() {
  console.log('🚀 Executing migrations...\n');
  console.log(`📍 Supabase URL: ${supabaseUrl}\n`);

  // Use pg to execute SQL directly
  const { Client } = await import('pg');
  
  // Extract database connection info from Supabase URL
  // Supabase connection string format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
  // We need to construct this from the service role key or use direct connection
  
  // For Supabase, we can use the REST API or direct Postgres connection
  // Let's try using the PostgREST API with service role key
  
  for (let i = 0; i < migrations.length; i++) {
    const migrationFile = migrations[i];
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile);
    
    try {
      console.log(`📄 Migration ${i + 1}/${migrations.length}: ${migrationFile}`);
      const sql = readFileSync(migrationPath, 'utf-8');
      
      // Execute via Supabase REST API using rpc or direct SQL execution
      // Note: Supabase doesn't expose direct SQL execution via REST API for security
      // We need to use pg client with connection string
      
      // Try to get connection string from environment or construct it
      const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
      
      if (dbUrl) {
        const client = new Client({ connectionString: dbUrl });
        await client.connect();
        
        try {
          await client.query(sql);
          console.log(`   ✅ Applied successfully\n`);
        } catch (err: any) {
          // Some errors are expected (e.g., "already exists")
          if (
            err.message.includes('already exists') ||
            err.message.includes('does not exist') ||
            err.message.includes('duplicate')
          ) {
            console.log(`   ⚠️  ${err.message} (continuing...)\n`);
          } else {
            throw err;
          }
        } finally {
          await client.end();
        }
      } else {
        // Fallback: Use Supabase Management API if available
        console.log(`   ⚠️  DATABASE_URL not found. Cannot execute SQL directly.`);
        console.log(`   Please apply manually or set DATABASE_URL in .env\n`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(`   ❌ Migration file not found: ${migrationPath}`);
        process.exit(1);
      } else {
        console.error(`   ❌ Error: ${error.message}`);
        throw error;
      }
    }
  }
  
  console.log('✅ All migrations processed!');
}

executeMigrations().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
