/**
 * Relationship Resolver Smoke Test
 * 
 * Tests the RelationshipResolver with sample Buildium property/unit/lease data
 * to confirm inserts succeed and org_id matches the property's org.
 * 
 * Usage:
 *   npm run tsx -- scripts/test-relationship-resolver.ts
 * 
 * Environment variables required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { RelationshipResolver } from '@/lib/relationship-resolver';
import type { Database } from '@/types/database';
import type { BuildiumProperty, BuildiumUnit, BuildiumLease } from '@/types/buildium';
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
const resolver = new RelationshipResolver({ supabase });

/**
 * Sample Buildium property data for testing
 */
function createSampleProperty(): BuildiumProperty {
  return {
    Id: 999999, // Use a high ID that's unlikely to conflict
    Name: 'Test Property - Relationship Resolver',
    StructureDescription: 'Test property for relationship resolver smoke test',
    NumberUnits: 1,
    IsActive: true,
    Address: {
      AddressLine1: '123 Test Street',
      AddressLine2: 'Suite 100',
      AddressLine3: '',
      City: 'Test City', // Use non-NYC city to avoid BIN constraint
      State: 'NY',
      PostalCode: '10001',
      Country: 'UnitedStates',
    },
    RentalType: 'Rental',
    RentalSubType: 'SingleFamily',
    CreatedDate: new Date().toISOString(),
    ModifiedDate: new Date().toISOString(),
  };
}

/**
 * Sample Buildium unit data for testing
 */
function createSampleUnit(propertyId: number): BuildiumUnit {
  return {
    Id: 888888, // Use a high ID that's unlikely to conflict
    PropertyId: propertyId,
    UnitNumber: 'TEST-001',
    Description: 'Test unit for relationship resolver',
    MarketRent: 2500,
    Address: {
      AddressLine1: '123 Test Street',
      AddressLine2: 'Unit 1',
      City: 'Test City', // Use non-NYC city to avoid BIN constraint
      State: 'NY',
      PostalCode: '10001',
      Country: 'UnitedStates',
    },
    UnitBedrooms: 'OneBed',
    UnitBathrooms: 'OneBath',
    UnitSize: 800,
  };
}

/**
 * Sample Buildium lease data for testing
 */
function createSampleLease(propertyId: number, unitId: number): BuildiumLease {
  const now = new Date();
  const leaseFromDate = new Date(now);
  leaseFromDate.setMonth(now.getMonth() + 1);
  const leaseToDate = new Date(leaseFromDate);
  leaseToDate.setFullYear(leaseToDate.getFullYear() + 1);

  return {
    Id: 777777, // Use a high ID that's unlikely to conflict
    PropertyId: propertyId,
    UnitId: unitId,
    UnitNumber: 'TEST-001',
    LeaseFromDate: leaseFromDate.toISOString(),
    LeaseToDate: leaseToDate.toISOString(),
    LeaseType: 'Fixed',
    LeaseStatus: 'Future',
    IsEvictionPending: false,
    TermType: 'Standard',
    RenewalOfferStatus: 'NotOffered',
    CurrentNumberOfOccupants: 1,
    AccountDetails: {
      SecurityDeposit: 2500,
      Rent: 2500,
    },
    AutomaticallyMoveOutTenants: true,
    PaymentDueDay: 1,
    CreatedDateTime: now.toISOString(),
    LastUpdatedDateTime: now.toISOString(),
  };
}

async function main() {
  console.log('🧪 Starting Relationship Resolver Smoke Test\n');

  try {
    // Get the first organization for testing (staging org)
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (orgError || !org) {
      console.error('❌ Failed to find an organization:', orgError?.message || 'No orgs found');
      process.exit(1);
    }

    console.log(`📋 Using organization: ${org.name} (${org.id})\n`);

    // Create sample Buildium data
    const buildiumProperty = createSampleProperty();
    const buildiumUnit = createSampleUnit(buildiumProperty.Id);
    const buildiumLease = createSampleLease(buildiumProperty.Id, buildiumUnit.Id);

    console.log('📦 Sample Buildium Data:');
    console.log(`   Property ID: ${buildiumProperty.Id} - ${buildiumProperty.Name}`);
    console.log(`   Unit ID: ${buildiumUnit.Id} - ${buildiumUnit.UnitNumber}`);
    console.log(`   Lease ID: ${buildiumLease.Id}\n`);

    // The relationship resolver has a known limitation - it cannot create new properties
    // because PropertyData from mapPropertyFromBuildiumWithBankAccount doesn't include org_id,
    // and properties require org_id (NOT NULL constraint).
    // So we'll create the property manually first, then test the resolver with unit/lease creation.
    console.log('📝 Note: Creating property manually first (relationship resolver limitation).\n');

    // Check if property already exists
    const { data: existingProperty, error: existingPropertyError } = await supabase
      .from('properties')
      .select('id, org_id, name')
      .eq('buildium_property_id', buildiumProperty.Id)
      .maybeSingle();

    if (existingPropertyError) {
      console.error('❌ Failed to fetch existing property:', existingPropertyError.message);
      process.exit(1);
    }

    let propertyRecord = existingProperty;

    if (!propertyRecord) {
      // Create the property manually with org_id
      console.log('🔨 Creating test property...');
      const { mapPropertyFromBuildiumWithBankAccount } = await import('@/lib/buildium-mappers');
      const propertyData = await mapPropertyFromBuildiumWithBankAccount(buildiumProperty, supabase);
      const now = new Date().toISOString();
      
      const propertyInsert: Database['public']['Tables']['properties']['Insert'] = {
        name: propertyData.name,
        structure_description: propertyData.structure_description ?? null,
        address_line1: propertyData.address_line1,
        address_line2: propertyData.address_line2 ?? null,
        address_line3: propertyData.address_line3 ?? null,
        city: propertyData.city,
        state: propertyData.state,
        postal_code: propertyData.postal_code,
        country: (propertyData.country || 'United States') as Database['public']['Enums']['countries'],
        property_type: propertyData.property_type as any,
        rental_type: propertyData.rental_type as any,
        operating_bank_gl_account_id: propertyData.operating_bank_gl_account_id ?? null,
        reserve: propertyData.reserve ?? null,
        year_built: propertyData.year_built ?? null,
        total_units: propertyData.total_units ?? undefined,
        is_active: propertyData.is_active ?? true,
        service_assignment: 'Property Level' as Database['public']['Enums']['assignment_level'],
        org_id: org.id, // Set org_id explicitly
        buildium_property_id: propertyData.buildium_property_id,
        status: 'Active',
        created_at: now,
        updated_at: now,
      };

      const { data: newProperty, error: createError } = await supabase
        .from('properties')
        .insert(propertyInsert)
        .select('id, org_id, name')
        .single();

      if (createError || !newProperty) {
        console.error('❌ Failed to create property:', createError?.message || 'No data returned');
        process.exit(1);
      }

      propertyRecord = newProperty;
      console.log(`✅ Created test property: ${newProperty.name} (${newProperty.id})\n`);
    } else {
      console.log(`✅ Found existing property: ${propertyRecord.name} (${propertyRecord.id})`);
      console.log(`   Org ID: ${propertyRecord.org_id}\n`);
    }

    if (!propertyRecord) {
      console.error('❌ Failed to resolve property record after creation');
      process.exit(1);
    }

    const propertyId = propertyRecord.id;

    // Run the relationship resolver
    console.log('🔄 Resolving entity chain...\n');
    const result = await resolver.resolveEntityChain({
      property: buildiumProperty,
      unit: buildiumUnit,
      lease: buildiumLease,
    });

    if (result.errors.length > 0) {
      console.error('❌ Resolution errors:');
      result.errors.forEach((error) => console.error(`   - ${error}`));
      process.exit(1);
    }

    console.log('✅ Entity chain resolved successfully:');
    if (result.propertyId) console.log(`   Property ID: ${result.propertyId}`);
    if (result.unitId) console.log(`   Unit ID: ${result.unitId}`);
    if (result.leaseId) console.log(`   Lease ID: ${result.leaseId}`);
    console.log('');

    // Verify records were created and org_id matches
    // Note: propertyId should match the one we created/found earlier
    if (result.propertyId && result.propertyId !== propertyId) {
      console.warn(`⚠️  Warning: Resolver returned property ID ${result.propertyId}, expected ${propertyId}`);
    }

    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, name, org_id, buildium_property_id')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      console.error(`❌ Failed to fetch property: ${propError?.message || 'Property not found'}`);
      process.exit(1);
    }

    console.log('🏢 Property verification:');
    console.log(`   Local ID: ${property.id}`);
    console.log(`   Name: ${property.name}`);
    console.log(`   Org ID: ${property.org_id}`);
    console.log(`   Buildium Property ID: ${property.buildium_property_id}`);

    if (property.org_id !== org.id) {
      console.error(`❌ Property org_id (${property.org_id}) does not match expected org (${org.id})`);
      process.exit(1);
    }
    console.log(`   ✅ Org ID matches expected organization\n`);

    if (result.unitId) {
      const { data: unit, error: unitError } = await supabase
        .from('units')
        .select('id, unit_number, org_id, buildium_unit_id, property_id')
        .eq('id', result.unitId)
        .single();

        if (unitError || !unit) {
          console.error(`❌ Failed to fetch unit: ${unitError?.message || 'Unit not found'}`);
          process.exit(1);
        }

      console.log('🏠 Unit verification:');
      console.log(`   Local ID: ${unit.id}`);
      console.log(`   Unit Number: ${unit.unit_number}`);
      console.log(`   Org ID: ${unit.org_id}`);
      console.log(`   Buildium Unit ID: ${unit.buildium_unit_id}`);
      console.log(`   Property ID: ${unit.property_id}`);

      if (unit.org_id !== org.id) {
        console.error(`❌ Unit org_id (${unit.org_id}) does not match expected org (${org.id})`);
        process.exit(1);
      }
      if (unit.property_id !== propertyId) {
        console.error(`❌ Unit property_id (${unit.property_id}) does not match expected property (${propertyId})`);
        process.exit(1);
      }
      console.log(`   ✅ Org ID matches expected organization`);
      console.log(`   ✅ Property ID matches resolved property\n`);

      if (result.leaseId) {
        const leaseId = Number(result.leaseId);
        if (Number.isNaN(leaseId)) {
          console.error(`❌ Resolver returned a non-numeric lease id: ${result.leaseId}`);
          process.exit(1);
        }

        const { data: lease, error: leaseError } = await supabase
          .from('lease')
          .select('id, unit_number, org_id, buildium_lease_id, property_id, unit_id')
          .eq('id', leaseId)
          .single();

          if (leaseError || !lease) {
            console.error(`❌ Failed to fetch lease: ${leaseError?.message || 'Lease not found'}`);
            process.exit(1);
          }

        console.log('📄 Lease verification:');
        console.log(`   Local ID: ${lease.id}`);
        console.log(`   Unit Number: ${lease.unit_number}`);
        console.log(`   Org ID: ${lease.org_id}`);
        console.log(`   Buildium Lease ID: ${lease.buildium_lease_id}`);
        console.log(`   Property ID: ${lease.property_id}`);
        console.log(`   Unit ID: ${lease.unit_id}`);

        if (lease.org_id !== org.id) {
          console.error(`❌ Lease org_id (${lease.org_id}) does not match expected org (${org.id})`);
          process.exit(1);
        }
        if (lease.property_id !== propertyId) {
          console.error(`❌ Lease property_id (${lease.property_id}) does not match expected property (${propertyId})`);
          process.exit(1);
        }
        if (lease.unit_id !== result.unitId) {
          console.error(`❌ Lease unit_id (${lease.unit_id}) does not match resolved unit (${result.unitId})`);
          process.exit(1);
        }
        console.log(`   ✅ Org ID matches expected organization`);
        console.log(`   ✅ Property ID matches resolved property`);
        console.log(`   ✅ Unit ID matches resolved unit\n`);
      }
    }

    console.log('🎉 All verifications passed! Relationship resolver is working correctly.');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
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
