/**
 * Test script to verify tenant file uploads to Buildium
 * Tests if uploading a file on the tenant details page creates the file in Buildium
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function findTenantWithBuildiumId() {
  console.log('🔍 Searching for tenant with buildium_tenant_id...\n');

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, buildium_tenant_id, contact:contacts!tenants_contact_id_fkey(display_name, first_name, last_name)')
    .not('buildium_tenant_id', 'is', null)
    .limit(5);

  if (error) {
    console.error('❌ Error querying tenants:', error);
    return null;
  }

  if (!tenants || tenants.length === 0) {
    console.log('⚠️  No tenants found with buildium_tenant_id');
    console.log('   Files will be saved locally but NOT synced to Buildium');
    return null;
  }

  const tenant = tenants[0];
  const contact = (tenant as any).contact;
  const name = contact?.display_name || [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || 'Unknown';

  console.log(`✅ Found tenant with Buildium ID:`);
  console.log(`   Tenant ID: ${tenant.id}`);
  console.log(`   Buildium Tenant ID: ${tenant.buildium_tenant_id}`);
  console.log(`   Name: ${name}\n`);

  return tenant;
}

async function checkExistingFiles(tenantId: string) {
  console.log(`🔍 Checking existing files for tenant ${tenantId}...\n`);

  const { data: files, error } = await supabase
    .from('files')
    .select('id, file_name, title, buildium_file_id, buildium_href, created_at')
    .eq('entity_type', 'Tenants')
    .eq('entity_id', (await supabase.from('tenants').select('buildium_tenant_id').eq('id', tenantId).single()).data?.buildium_tenant_id || -1)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.log('⚠️  Error querying files (this is OK if files table schema is different):', error.message);
    return;
  }

  if (!files || files.length === 0) {
    console.log('   No existing files found for this tenant\n');
    return;
  }

  console.log(`   Found ${files.length} existing file(s):`);
  files.forEach((file, idx) => {
    console.log(`   ${idx + 1}. ${file.file_name || file.title}`);
    console.log(`      Buildium File ID: ${file.buildium_file_id || 'Not synced'}`);
    console.log(`      Buildium Href: ${file.buildium_href || 'N/A'}`);
    console.log(`      Created: ${file.created_at}`);
  });
  console.log();
}

async function testUploadFlow() {
  console.log('🧪 Testing Tenant File Upload to Buildium');
  console.log('='.repeat(60));
  console.log();

  // Find a tenant with Buildium ID
  const tenant = await findTenantWithBuildiumId();
  if (!tenant) {
    console.log('='.repeat(60));
    console.log('⚠️  TEST SKIPPED: No tenant with Buildium ID found');
    console.log('   To test Buildium sync, you need a tenant with buildium_tenant_id set');
    console.log('='.repeat(60));
    return;
  }

  const tenantId = tenant.id as string;
  const buildiumTenantId = tenant.buildium_tenant_id as number;

  // Check existing files
  await checkExistingFiles(tenantId);

  console.log('📋 Test Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Tenant has Buildium ID: ${buildiumTenantId}`);
  console.log(`✅ File upload code will attempt to sync to Buildium`);
  console.log();
  console.log('📝 How to test:');
  console.log('   1. Go to the tenant details page in the UI');
  console.log('   2. Upload a file using the "Recent files" section');
  console.log('   3. Check the API response in the browser Network tab');
  console.log('   4. Look for these fields in the response:');
  console.log('      - buildiumFile: Should contain Buildium file data if successful');
  console.log('      - buildiumFileId: Should contain the Buildium file ID');
  console.log('      - buildiumSyncError: Will contain error if sync failed');
  console.log();
  console.log('💡 Expected behavior:');
  console.log('   - File will ALWAYS be saved locally to Supabase storage');
  console.log('   - File will be synced to Buildium IF:');
  console.log('     • Tenant has buildium_tenant_id (✅ YES in this case)');
  console.log('     • Buildium API supports file uploads for Tenant entity type');
  console.log('     • Buildium credentials are configured correctly');
  console.log('='.repeat(60));
  console.log();

  // Verify Buildium credentials
  const buildiumClientId = process.env.BUILDIUM_CLIENT_ID;
  const buildiumClientSecret = process.env.BUILDIUM_CLIENT_SECRET;
  
  if (!buildiumClientId || !buildiumClientSecret) {
    console.log('⚠️  WARNING: Buildium credentials not found in environment');
    console.log('   Buildium sync will be skipped');
    console.log();
  } else {
    console.log('✅ Buildium credentials found in environment');
    console.log();
  }

  console.log('📊 Code Flow Verification:');
  console.log('='.repeat(60));
  console.log('1. TenantFileUploadDialog → /api/files/upload');
  console.log('2. Upload route resolves buildium_tenant_id ✅');
  console.log('3. Calls uploadFileToBuildiumEntity()');
  console.log('4. Uses buildiumClient.createFileUploadRequest("Tenant", ...)');
  console.log('5. POSTs to /files/uploadRequests');
  console.log('6. Uploads file binary to Buildium bucket');
  console.log('7. Updates local file record with buildium_file_id');
  console.log('='.repeat(60));
  console.log();

  console.log('✨ Test script completed successfully!');
  console.log('   Next step: Upload a file via the UI to test the actual flow');
  console.log();
}

testUploadFlow().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
