/**
 * Debug Unit Sync Script
 * 
 * Re-syncs a Buildium unit with sparse address data to verify new defaults behave as expected.
 * 
 * Usage:
 *   npm run tsx -- scripts/debug-unit-sync.ts <UnitId>
 * 
 * Example:
 *   npm run tsx -- scripts/debug-unit-sync.ts 12345
 * 
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - BUILDIUM_CLIENT_ID (optional, uses env defaults)
 *   - BUILDIUM_CLIENT_SECRET (optional, uses env defaults)
 */

import { createClient } from '@supabase/supabase-js';
import UnitService from '@/lib/unit-service';
import type { Database } from '@/types/database';
import type { BuildiumUnit } from '@/types/buildium';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function main() {
  const args = process.argv.slice(2);
  const unitIdArg = args[0];

  if (!unitIdArg) {
    console.error('❌ Missing required argument: UnitId');
    console.error('Usage: npm run tsx -- scripts/debug-unit-sync.ts <UnitId>');
    process.exit(1);
  }

  const buildiumUnitId = parseInt(unitIdArg, 10);
  if (isNaN(buildiumUnitId)) {
    console.error(`❌ Invalid UnitId: ${unitIdArg}. Must be a number.`);
    process.exit(1);
  }

  console.log(`🔄 Syncing Buildium Unit ID: ${buildiumUnitId}\n`);

  try {
    // Fetch the unit from Buildium first to see the raw data
    console.log('📥 Fetching unit from Buildium...');
    const buildiumUnit: BuildiumUnit | null = await UnitService.getFromBuildium(buildiumUnitId, false);

    if (!buildiumUnit) {
      console.error(`❌ Unit ${buildiumUnitId} not found in Buildium`);
      process.exit(1);
    }

    console.log('✅ Unit fetched from Buildium:');
    console.log(`   Unit ID: ${buildiumUnit.Id}`);
    console.log(`   Unit Number: ${buildiumUnit.UnitNumber}`);
    console.log(`   Property ID: ${buildiumUnit.PropertyId}`);
    console.log('\n📍 Address Data (from Buildium):');
    if (buildiumUnit.Address) {
      console.log(`   AddressLine1: ${buildiumUnit.Address.AddressLine1 || '(empty)'}`);
      console.log(`   AddressLine2: ${buildiumUnit.Address.AddressLine2 || '(empty)'}`);
      console.log(`   AddressLine3: ${buildiumUnit.Address.AddressLine3 || '(empty)'}`);
      console.log(`   City: ${buildiumUnit.Address.City || '(empty)'}`);
      console.log(`   State: ${buildiumUnit.Address.State || '(empty)'}`);
      console.log(`   PostalCode: ${buildiumUnit.Address.PostalCode || '(empty)'}`);
      console.log(`   Country: ${buildiumUnit.Address.Country || '(empty)'}`);
    } else {
      console.log('   (No address data)');
    }
    console.log('');

    // Find the property to get org_id
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, name, org_id')
      .eq('buildium_property_id', buildiumUnit.PropertyId)
      .maybeSingle();

    if (propError) {
      console.error(`❌ Failed to find property: ${propError.message}`);
      process.exit(1);
    }

    if (!property) {
      console.error(`❌ Property ${buildiumUnit.PropertyId} not found locally. Please sync the property first.`);
      process.exit(1);
    }

    console.log(`🏢 Found local property: ${property.name} (${property.id})`);
    console.log(`   Org ID: ${property.org_id}\n`);

    // Check if unit already exists
    const { data: existingUnit, error: existingError } = await supabase
      .from('units')
      .select('id, unit_number, address_line1, city, state, postal_code, country, org_id, property_id')
      .eq('buildium_unit_id', buildiumUnitId)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error(`❌ Error checking for existing unit: ${existingError.message}`);
      process.exit(1);
    }

    if (existingUnit) {
      console.log('📋 Existing unit before sync:');
      console.log(`   Local ID: ${existingUnit.id}`);
      console.log(`   Unit Number: ${existingUnit.unit_number}`);
      console.log(`   Address Line1: ${existingUnit.address_line1 || '(empty)'}`);
      console.log(`   City: ${existingUnit.city || '(empty)'}`);
      console.log(`   State: ${existingUnit.state || '(empty)'}`);
      console.log(`   Postal Code: ${existingUnit.postal_code || '(empty)'}`);
      console.log(`   Country: ${existingUnit.country || '(empty)'}`);
      console.log(`   Org ID: ${existingUnit.org_id}`);
      console.log(`   Property ID: ${existingUnit.property_id}\n`);
    } else {
      console.log('📋 Unit does not exist locally yet (will be created)\n');
    }

    // Sync the unit (persist to DB)
    console.log('🔄 Syncing unit to database...');
    const localUnitId = await UnitService.persistBuildiumUnit(buildiumUnit, property.org_id);

    if (!localUnitId) {
      console.error('❌ Failed to sync unit');
      process.exit(1);
    }

    console.log(`✅ Unit synced successfully. Local ID: ${localUnitId}\n`);

    // Fetch the synced unit to verify the data
    const { data: syncedUnit, error: syncError } = await supabase
      .from('units')
      .select('id, unit_number, address_line1, address_line2, address_line3, city, state, postal_code, country, org_id, property_id, buildium_unit_id')
      .eq('id', localUnitId)
      .single();

    if (syncError || !syncedUnit) {
      console.error(`❌ Failed to fetch synced unit: ${syncError?.message || 'Unit not found'}`);
      process.exit(1);
    }

    console.log('✅ Synced unit data (verifying defaults):');
    console.log(`   Local ID: ${syncedUnit.id}`);
    console.log(`   Unit Number: ${syncedUnit.unit_number}`);
    console.log('\n📍 Address Data (after sync):');
    console.log(`   Address Line1: ${syncedUnit.address_line1 || '(empty - check defaults!)'}`);
    console.log(`   Address Line2: ${syncedUnit.address_line2 || '(empty)'}`);
    console.log(`   Address Line3: ${syncedUnit.address_line3 || '(empty)'}`);
    console.log(`   City: ${syncedUnit.city || '(empty - check defaults!)'}`);
    console.log(`   State: ${syncedUnit.state || '(empty - check defaults!)'}`);
    console.log(`   Postal Code: ${syncedUnit.postal_code || '(empty - check defaults!)'}`);
    console.log(`   Country: ${syncedUnit.country || '(empty - check defaults!)'}`);
    console.log('\n🔗 Relationships:');
    console.log(`   Org ID: ${syncedUnit.org_id}`);
    console.log(`   Property ID: ${syncedUnit.property_id}`);
    console.log(`   Buildium Unit ID: ${syncedUnit.buildium_unit_id}`);

    // Verify org_id matches property
    if (syncedUnit.org_id !== property.org_id) {
      console.error(`\n❌ Org ID mismatch! Unit org_id (${syncedUnit.org_id}) does not match property org_id (${property.org_id})`);
      process.exit(1);
    }

    // Verify property_id matches
    if (syncedUnit.property_id !== property.id) {
      console.error(`\n❌ Property ID mismatch! Unit property_id (${syncedUnit.property_id}) does not match property id (${property.id})`);
      process.exit(1);
    }

    // Check if sparse address fields have defaults
    const hasSparseAddress = 
      !buildiumUnit.Address?.AddressLine1 ||
      !buildiumUnit.Address?.City ||
      !buildiumUnit.Address?.State ||
      !buildiumUnit.Address?.PostalCode;

    if (hasSparseAddress) {
      console.log('\n⚠️  Unit has sparse address data in Buildium');
      console.log('   Verifying that defaults were applied correctly...');
      
      // Verify defaults were applied (should not be empty strings)
      if (!syncedUnit.address_line1 || syncedUnit.address_line1 === '') {
        console.warn('   ⚠️  address_line1 is empty - defaults may not be working');
      }
      if (!syncedUnit.city || syncedUnit.city === '') {
        console.warn('   ⚠️  city is empty - defaults may not be working');
      }
      if (!syncedUnit.state || syncedUnit.state === '') {
        console.warn('   ⚠️  state is empty - defaults may not be working');
      }
      if (!syncedUnit.postal_code || syncedUnit.postal_code === '') {
        console.warn('   ⚠️  postal_code is empty - defaults may not be working');
      }
    }

    console.log('\n🎉 Unit sync completed successfully!');
  } catch (error) {
    console.error('❌ Error syncing unit:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
      if (error.stack) {
        console.error('   Stack:', error.stack);
      }
    }
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export { main };

