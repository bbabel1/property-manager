/**
 * Helper script to display migration SQL for manual application
 * Usage: npx tsx scripts/apply-migrations-helper.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const migrations = [
  {
    file: '20250108000000_backfill_account_entity_type.sql',
    description: 'Backfill missing account_entity_type values and add constraints',
  },
  {
    file: '20250108000001_fix_balance_entity_type_filtering.sql',
    description: 'Fix gl_account_balance_as_of to filter by entity type',
  },
  {
    file: '20250108000002_fix_get_property_financials_entity_type.sql',
    description: 'Fix get_property_financials to only include Rental entity type',
  },
  {
    file: '20250108000003_fix_v_gl_account_balances_entity_type.sql',
    description: 'Fix v_gl_account_balances_as_of to filter property-scoped balances',
  },
];

console.log('📋 Double-Entry Bookkeeping Balance Fix Migrations\n');
console.log('=' .repeat(70));
console.log('Apply these migrations in order using Supabase Dashboard SQL Editor');
console.log('=' .repeat(70));
console.log('');

migrations.forEach((migration, index) => {
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', migration.file);
  
  try {
    const sql = readFileSync(migrationPath, 'utf-8');
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Migration ${index + 1}/${migrations.length}: ${migration.file}`);
    console.log(`Description: ${migration.description}`);
    console.log(`${'='.repeat(70)}\n`);
    console.log(sql);
    console.log(`\n${'='.repeat(70)}`);
    console.log(`End of Migration ${index + 1}`);
    console.log(`${'='.repeat(70)}\n\n`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(`❌ Migration file not found: ${migrationPath}`);
    } else {
      console.error(`❌ Error reading migration: ${error.message}`);
    }
  }
});

console.log('\n✅ Migration SQL displayed above');
console.log('\n📋 Instructions:');
console.log('1. Copy each migration SQL above');
console.log('2. Go to Supabase Dashboard > SQL Editor');
console.log('3. Paste and run each migration in order');
console.log('4. Verify each migration completes successfully');
console.log('5. Run diagnostic: npx tsx scripts/diagnostics/check-double-entry-balance-issues.ts\n');
