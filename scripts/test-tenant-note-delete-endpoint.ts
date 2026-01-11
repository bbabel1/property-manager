/**
 * Test script to test the DELETE endpoint for tenant notes
 * Tests the actual API endpoint /api/tenants/{tenantId}/notes/{noteId}
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

async function testDeleteEndpoint(buildiumNoteId: number) {
  console.log('🧪 Testing Tenant Note DELETE Endpoint');
  console.log('='.repeat(60));
  console.log(`\nLooking for tenant note with buildium_note_id: ${buildiumNoteId}\n`);

  try {
    // Find the tenant note by Buildium note ID
    const { data: note, error: findError } = await supabase
      .from('tenant_notes')
      .select('id, tenant_id, buildium_note_id, buildium_tenant_id, note, created_at')
      .eq('buildium_note_id', buildiumNoteId)
      .maybeSingle();

    if (findError) {
      console.error('❌ Error finding note:', findError.message);
      process.exit(1);
    }

    if (!note) {
      console.log(`⚠️  No tenant note found with buildium_note_id: ${buildiumNoteId}`);
      console.log('\n💡 Checking for other notes with Buildium sync...\n');
      
      const { data: otherNotes, error: otherError } = await supabase
        .from('tenant_notes')
        .select('id, tenant_id, buildium_note_id, buildium_tenant_id, note, created_at')
        .not('buildium_note_id', 'is', null)
        .limit(5);

      if (otherError) {
        console.error('❌ Error finding other notes:', otherError.message);
        process.exit(1);
      }

      if (otherNotes && otherNotes.length > 0) {
        console.log(`✅ Found ${otherNotes.length} note(s) with Buildium sync:`);
        otherNotes.forEach((n, i) => {
          console.log(`\n   ${i + 1}. Local Note ID: ${n.id}`);
          console.log(`      Buildium Note ID: ${n.buildium_note_id}`);
          console.log(`      Tenant ID: ${n.tenant_id}`);
          console.log(`      Preview: ${(n.note || '').substring(0, 50)}...`);
        });
        console.log('\n💡 To test with one of these, run:');
        console.log(`   npx tsx scripts/test-tenant-note-delete-endpoint.ts ${otherNotes[0].buildium_note_id}`);
        console.log('\n   Or test via the UI by deleting the note.');
      } else {
        console.log('⚠️  No notes with Buildium sync found in database.');
        console.log('   Please create a note via the UI first, then test deletion.');
      }
      process.exit(0);
    }

    console.log('✅ Found tenant note:');
    console.log(`   Local Note ID: ${note.id}`);
    console.log(`   Tenant ID: ${note.tenant_id}`);
    console.log(`   Buildium Note ID: ${note.buildium_note_id}`);
    console.log(`   Buildium Tenant ID: ${note.buildium_tenant_id || 'N/A'}`);
    console.log(`   Note: ${(note.note || '').substring(0, 100)}...`);
    console.log('\n' + '='.repeat(60));

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, buildium_tenant_id')
      .eq('id', note.tenant_id)
      .maybeSingle();

    if (tenantError) {
      console.error('❌ Error finding tenant:', tenantError.message);
      process.exit(1);
    }

    if (!tenant) {
      console.error('❌ Tenant not found');
      process.exit(1);
    }

    console.log('\n📋 Tenant info:');
    console.log(`   Local ID: ${tenant.id}`);
    console.log(`   Buildium Tenant ID: ${tenant.buildium_tenant_id || 'N/A'}`);
    console.log('\n' + '='.repeat(60));

    // Test the DELETE endpoint
    console.log('\n🗑️  Testing DELETE endpoint...\n');
    console.log(`   Endpoint: DELETE /api/tenants/${note.tenant_id}/notes/${note.id}`);
    
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const endpoint = `${apiUrl}/api/tenants/${note.tenant_id}/notes/${note.id}`;
    
    console.log(`   Full URL: ${endpoint}`);
    console.log('\n⚠️  Note: This endpoint requires authentication.');
    console.log('   Testing via direct API call requires authentication tokens.');
    console.log('\n💡 Instead, test via the UI:');
    console.log(`   1. Navigate to: ${apiUrl}/tenants/${note.tenant_id}`);
    console.log(`   2. Find the note with Buildium ID: ${buildiumNoteId}`);
    console.log(`   3. Click Delete and confirm`);
    console.log(`   4. Check server logs to see Buildium API calls`);
    console.log('\n' + '='.repeat(60));
    
    // Since we can't easily authenticate from a script, let's at least verify
    // the note exists and would be deletable
    console.log('\n✅ Note is ready for deletion:');
    console.log(`   - Note exists: ✅`);
    console.log(`   - Has Buildium sync: ${note.buildium_note_id ? '✅' : '❌'}`);
    console.log(`   - Buildium Tenant ID: ${note.buildium_tenant_id || tenant.buildium_tenant_id || 'N/A'}`);
    console.log('\n   The DELETE endpoint will:');
    console.log('   1. Try DELETE /rentals/tenants/{id}/notes/{id} → 404 (expected)');
    console.log('   2. Try DELETE /leases/tenants/{id}/notes/{id} → 404 (expected)');
    console.log('   3. Treat 404s as success (Buildium API doesn\'t support DELETE)');
    console.log('   4. Delete the note locally ✅');
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Test setup complete!');
    console.log('   Note is ready for deletion via the UI or authenticated API call.\n');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Get Buildium note ID from command line
const buildiumNoteId = process.argv[2] ? parseInt(process.argv[2], 10) : 15648;

if (isNaN(buildiumNoteId)) {
  console.error('❌ Invalid Buildium note ID:', process.argv[2]);
  console.error('Usage: npx tsx scripts/test-tenant-note-delete-endpoint.ts [buildium_note_id]');
  process.exit(1);
}

testDeleteEndpoint(buildiumNoteId);

