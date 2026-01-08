/**
 * Script to delete a property and its associated units
 * 
 * Usage: npx tsx scripts/delete-property.ts <property-id>
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_KEY);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const PROPERTY_ID = process.argv[2] || '43c5650a-a29d-474a-a3ca-5ae3939a3f9e';

async function checkProperty() {
  console.log(`\n🔍 Checking property: ${PROPERTY_ID}\n`);

  // Check property
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('id, name, public_id, address_line1, city, state')
    .eq('id', PROPERTY_ID)
    .maybeSingle();

  if (propError) {
    console.error('❌ Error checking property:', propError.message);
    process.exit(1);
  }

  if (!property) {
    console.error(`❌ Property ${PROPERTY_ID} not found`);
    process.exit(1);
  }

  console.log('Property found:');
  console.log(`  Name: ${property.name || 'N/A'}`);
  console.log(`  Public ID: ${property.public_id || 'N/A'}`);
  console.log(`  Address: ${property.address_line1 || ''} ${property.city || ''} ${property.state || ''}`);

  // Check units
  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id, unit_number, unit_name, public_id')
    .eq('property_id', PROPERTY_ID);

  if (unitsError) {
    console.error('❌ Error checking units:', unitsError.message);
    process.exit(1);
  }

  console.log(`\n📦 Associated units (${units?.length || 0}):`);
  if (units && units.length > 0) {
    units.forEach((unit, idx) => {
      console.log(`  ${idx + 1}. ${unit.unit_number || unit.unit_name || 'Unit'} (${unit.id})`);
    });
  } else {
    console.log('  No units found');
  }

  // Check for leases - more thorough check
  // Note: lease table uses snake_case (property_id, unit_id) not camelCase
  const unitIds = units?.map((u) => u.id) || [];
  let leases: any[] = [];
  
  // Query leases using multiple approaches (try both camelCase and snake_case)
  const queries = [];
  
  if (unitIds.length > 0) {
    // Try camelCase first
    queries.push(
      supabase.from('lease').select('id, "unitId", "propertyId", "buildiumLeaseId"').in('unitId', unitIds)
    );
    // Try snake_case
    queries.push(
      supabase.from('lease').select('id, unit_id, property_id, buildium_lease_id').in('unit_id', unitIds)
    );
  }
  // Try camelCase
  queries.push(
    supabase.from('lease').select('id, "unitId", "propertyId", "buildiumLeaseId"').eq('propertyId', PROPERTY_ID)
  );
  // Try snake_case
  queries.push(
    supabase.from('lease').select('id, unit_id, property_id, buildium_lease_id').eq('property_id', PROPERTY_ID)
  );
  
  const results = await Promise.all(queries);
  const allLeases: any[] = [];
  results.forEach((result) => {
    if (!result.error && result.data) {
      allLeases.push(...result.data);
    }
  });
  
  // Deduplicate
  leases = Array.from(new Map(allLeases.map((l) => [l.id, l])).values());

  // Check for transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, transaction_type, total_amount')
    .eq('property_id', PROPERTY_ID)
    .limit(5);

  const transactionCount = transactions?.length || 0;

  console.log(`\n⚠️  Related records:`);
  console.log(`  Leases: ${leases.length}`);
  if (leases.length > 0) {
    leases.forEach((lease, idx) => {
      console.log(`    ${idx + 1}. Lease ID: ${lease.id}`);
    });
  }
  console.log(`  Transactions: ${transactionCount}${transactionCount === 5 ? '+' : ''}`);

  if (leases.length > 0) {
    console.log('\n⚠️  WARNING: This property has associated leases. We will need to handle these first.');
    console.log('   The lease foreign keys do not have CASCADE delete, so we must update or delete leases first.');
  }

  return { property, units: units || [], leases };
}

async function deletePropertyAndUnits() {
  const { property, units, leases } = await checkProperty();

  console.log(`\n🗑️  Starting deletion process...\n`);

  // Handle leases - find all leases that reference this property or units via direct SQL if needed
  // First try the queries we have
  if (leases.length === 0 && units.length > 0) {
    // Re-query with snake_case column names
    console.log('⚠️  No leases found, but constraint error suggests they exist. Querying with snake_case columns...');
    
    const unitId = units[0].id;
    const { data: allLeases, error: allLeasesError } = await supabase
      .from('lease')
      .select('*')
      .or(`property_id.eq.${PROPERTY_ID},unit_id.eq.${unitId}`);
    
    if (!allLeasesError && allLeases && allLeases.length > 0) {
      console.log(`  Found ${allLeases.length} lease(s) via snake_case query`);
      leases.push(...allLeases);
    }
  }

  // Handle leases first - try to delete them or set foreign keys to NULL
  if (leases.length > 0) {
    console.log(`Handling ${leases.length} lease(s)...`);
    
    for (const lease of leases) {
      console.log(`  Processing lease: ${lease.id}`);
      
      // Try to delete the lease directly first
      const { error: deleteError } = await supabase
        .from('lease')
        .delete()
        .eq('id', lease.id);

      if (deleteError) {
        // If delete fails, try to nullify references
        console.log(`  ⚠️  Cannot delete lease ${lease.id}, attempting to nullify references...`);
        const updateData: any = {};
        // Handle both camelCase and snake_case
        const propertyId = lease.propertyId || lease.property_id;
        const unitId = lease.unitId || lease.unit_id;
        
        if (propertyId === PROPERTY_ID) {
          updateData.property_id = null;
        }
        if (units.some(u => u.id === unitId)) {
          updateData.unit_id = null;
        }
        
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('lease')
            .update(updateData)
            .eq('id', lease.id);

          if (updateError) {
            console.error(`  ❌ Error handling lease ${lease.id}:`, updateError.message);
            console.error(`     Cannot delete property/units - lease ${lease.id} must be handled manually`);
            console.error(`     Try: DELETE FROM lease WHERE id = '${lease.id}';`);
            process.exit(1);
          } else {
            console.log(`  ✓ Updated lease: ${lease.id} (nullified references)`);
          }
        }
      } else {
        console.log(`  ✓ Deleted lease: ${lease.id}`);
      }
    }
  } else {
    console.log('⚠️  No leases found. If deletion fails, there may be hidden lease references.');
  }

  // Delete units first (they have foreign key to property)
  if (units.length > 0) {
    console.log(`\nDeleting ${units.length} unit(s)...`);
    
    for (const unit of units) {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', unit.id);

      if (error) {
        console.error(`❌ Error deleting unit ${unit.id}:`, error.message);
        
        // If it's a foreign key error, provide helpful message
        if (error.message.includes('foreign key')) {
          console.error(`   This unit is still referenced by other records.`);
          console.error(`   You may need to manually check and delete: leases, transactions, or other related records.`);
        }
        
        process.exit(1);
      } else {
        console.log(`  ✓ Deleted unit: ${unit.unit_number || unit.unit_name || unit.id}`);
      }
    }
  }

  // Delete property
  console.log(`\nDeleting property...`);
  const { error: propDeleteError } = await supabase
    .from('properties')
    .delete()
    .eq('id', PROPERTY_ID);

  if (propDeleteError) {
    console.error('❌ Error deleting property:', propDeleteError.message);
    
    if (propDeleteError.message.includes('foreign key')) {
      console.error(`   This property is still referenced by other records.`);
      console.error(`   You may need to manually check and delete related records first.`);
    }
    
    process.exit(1);
  }

  console.log(`  ✓ Deleted property: ${property.name || PROPERTY_ID}`);
  console.log(`\n✅ Successfully deleted property and ${units.length} unit(s)\n`);
}

// Run the deletion
deletePropertyAndUnits().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
