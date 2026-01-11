/**
 * Test script to verify tenant note deletion
 * Tests deletion of a tenant note with a specific Buildium note ID
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

async function testTenantNoteDeletion(buildiumNoteId: number) {
  console.log('🧪 Testing Tenant Note Deletion');
  console.log('='.repeat(60));
  console.log(`\nLooking for tenant note with buildium_note_id: ${buildiumNoteId}\n`);

  try {
    // Find the tenant note
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
      console.log('\nThis could mean:');
      console.log('  - The note was already deleted');
      console.log('  - The note does not exist in the database');
      console.log('\n💡 Let me check for other notes with Buildium sync...\n');
      
      // Find any note with buildium_note_id
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
          console.log(`\n   ${i + 1}. Note ID: ${n.id}`);
          console.log(`      Buildium Note ID: ${n.buildium_note_id}`);
          console.log(`      Tenant ID: ${n.tenant_id}`);
          console.log(`      Preview: ${(n.note || '').substring(0, 50)}...`);
        });
        console.log('\n💡 To test with one of these, run:');
        console.log(`   npx tsx scripts/test-tenant-note-deletion.ts ${otherNotes[0].buildium_note_id}`);
      } else {
        console.log('⚠️  No notes with Buildium sync found in database.');
        console.log('   You may need to create a note first via the UI.');
      }
      process.exit(0);
    }

    console.log('✅ Found tenant note:');
    console.log(JSON.stringify(note, null, 2));
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

    // Verify the note details match what we expect
    console.log('\n🔍 Note details:');
    console.log(`   Local Note ID: ${note.id}`);
    console.log(`   Tenant ID: ${note.tenant_id}`);
    console.log(`   Buildium Note ID: ${note.buildium_note_id}`);
    console.log(`   Buildium Tenant ID: ${note.buildium_tenant_id || tenant.buildium_tenant_id || 'N/A'}`);
    console.log(`   Note preview: ${(note.note || '').substring(0, 50)}...`);

    console.log('\n' + '='.repeat(60));
    console.log('\n⚠️  Note: Buildium API does not support DELETE for tenant notes.');
    console.log('   This test will delete the note locally only.');
    console.log('   The note will remain in Buildium.');
    console.log('\n' + '='.repeat(60));

    // Test the deletion logic (simulating what the API endpoint does)
    console.log('\n🗑️  Testing deletion...\n');

    const buildiumTenantId = note.buildium_tenant_id ?? tenant.buildium_tenant_id ?? null;

    if (note.buildium_note_id && buildiumTenantId) {
      console.log('ℹ️  Note has Buildium sync data - logging deletion (Buildium API does not support DELETE)');
      console.log(`   Buildium Tenant ID: ${buildiumTenantId}`);
      console.log(`   Buildium Note ID: ${note.buildium_note_id}`);
    }

    // Delete the note
    const { error: deleteError } = await supabase
      .from('tenant_notes')
      .delete()
      .eq('id', note.id)
      .eq('tenant_id', note.tenant_id);

    if (deleteError) {
      console.error('❌ Error deleting note:', deleteError.message);
      process.exit(1);
    }

    console.log('✅ Note deleted successfully!\n');

    // Verify deletion
    const { data: verifyNote, error: verifyError } = await supabase
      .from('tenant_notes')
      .select('id')
      .eq('id', note.id)
      .maybeSingle();

    if (verifyError) {
      console.error('❌ Error verifying deletion:', verifyError.message);
      process.exit(1);
    }

    if (verifyNote) {
      console.error('❌ Note still exists after deletion!');
      process.exit(1);
    }

    console.log('✅ Verification: Note no longer exists in database');
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Test completed successfully!');
    console.log(`   Note ${note.id} (Buildium ID: ${buildiumNoteId}) has been deleted locally.`);
    console.log('   The note remains in Buildium (Buildium API does not support DELETE).\n');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Get Buildium note ID from command line or use default
const buildiumNoteId = process.argv[2] ? parseInt(process.argv[2], 10) : 15648;

if (isNaN(buildiumNoteId)) {
  console.error('❌ Invalid Buildium note ID:', process.argv[2]);
  console.error('Usage: npx tsx scripts/test-tenant-note-deletion.ts [buildium_note_id]');
  process.exit(1);
}

testTenantNoteDeletion(buildiumNoteId);
