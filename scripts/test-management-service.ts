#!/usr/bin/env npx tsx
/**
 * Quick diagnostic script for Management Services API helpers.
 *
 * Usage:
 *   npx tsx scripts/test-management-service.ts --property <propertyId> [--unit <unitId>] [--plan "Full"] [--services "Rent Collection,Maintenance"] [--bill "Notes"]
 */

import { config } from 'dotenv';
import { ManagementService } from '@/lib/management-service';

config({ path: '.env.local' });

function getArg(flag: string) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

function parseServices(value: string | null) {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

async function main() {
  const propertyId = getArg('--property');
  const unitId = getArg('--unit');
  const plan = getArg('--plan');
  const servicesArg = parseServices(getArg('--services'));
  const bill = getArg('--bill');

  if (!propertyId) {
    console.error(
      'Usage: --property <propertyId> [--unit <unitId>] [--plan "Plan Name"] [--services "A,B"] [--bill "Notes"]',
    );
    process.exit(1);
  }

  const client = new ManagementService(propertyId, unitId || undefined);

  console.log('🔍 Fetching current configuration...');
  const current = await client.getServiceConfiguration();
  console.log(JSON.stringify(current, null, 2));

  if (plan) {
    console.log('\n✏️ Updating configuration...');
    const updated = await client.updateServiceConfiguration({
      service_plan: plan,
      active_services: servicesArg.length ? servicesArg : undefined,
      bill_administration: bill ?? undefined,
    });
    console.log(JSON.stringify(updated, null, 2));
  } else {
    console.log('\n(no update requested; pass --plan to apply changes)');
  }
}

main().catch((err) => {
  console.error('Management service test failed:', err);
  process.exit(1);
});
