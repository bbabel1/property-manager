#!/usr/bin/env npx tsx
/**
 * Detect legacy management service fields and outline backfill options.
 *
 * - Reports whether `properties.active_services` / `units.active_services` columns still exist.
 * - If present, recommends backfilling to service_plan_assignments/service_offering_assignments.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

async function columnExists(table: string, column: string) {
  const { data, error } = await supabase
    .from('information_schema.columns' as any)
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', table)
    .eq('column_name', column)
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function main() {
  const propsActive = await columnExists('properties', 'active_services').catch(() => false);
  const unitsActive = await columnExists('units', 'active_services').catch(() => false);

  console.log('Legacy management service columns:');
  console.log(`- properties.active_services: ${propsActive ? 'present' : 'absent'}`);
  console.log(`- units.active_services: ${unitsActive ? 'present' : 'absent'}`);

  if (!propsActive && !unitsActive) {
    console.log('No legacy columns found. You can safely rely on service_plan_assignments + offerings.');
    return;
  }

  console.log('\nIf present, backfill to the new model:');
  console.log('- Property-level: create service_plan_assignments rows and map active_services to offering assignments.');
  console.log('- Unit-level: create unit-scoped assignments using units.active_services (fallback to property when empty).');
  console.log('Reference migration: 20270127122000_backfill_service_plan_assignments_from_legacy.sql for the SQL pattern.');
}

main().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});
