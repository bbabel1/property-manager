import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required environment variables')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function deleteContact31() {
  const contactId = 31

  console.log(`\n=== Deleting Contact ${contactId} and all linked records ===\n`)

  try {
    // Step 1: Find and display the contact
    console.log('Step 1: Finding contact...')
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      throw new Error(`Contact ${contactId} not found: ${contactError?.message}`)
    }

    console.log(`Found contact: ${contact.first_name} ${contact.last_name} (${contact.company_name || 'N/A'})`)

    // Step 2: Find owner "Test First Test Last" linked to this contact
    console.log('\nStep 2: Finding owner records...')
    const { data: owners, error: ownersError } = await supabase
      .from('owners')
      .select('id, contact_id')
      .eq('contact_id', contactId)

    if (ownersError) {
      throw new Error(`Error finding owners: ${ownersError.message}`)
    }

    console.log(`Found ${owners.length} owner(s) linked to contact ${contactId}`)
    
    // Verify we found the "Test First Test Last" owner
    let foundTestOwner = false
    if (owners.length > 0) {
      for (const owner of owners) {
        // Since all owners have the same contact_id (contactId), we can check the contact directly
        if (contact.first_name === 'Test First' && contact.last_name === 'Test Last') {
          foundTestOwner = true
          console.log(`✓ Found owner "Test First Test Last": ${owner.id}`)
        }
      }
    }

    if (!foundTestOwner && owners.length > 0 && (contact.first_name !== 'Test First' || contact.last_name !== 'Test Last')) {
      console.log('⚠️  Warning: Owner "Test First Test Last" not found, but proceeding with deletion of all owners linked to contact 31')
    }

    // Step 3: Delete ownerships for all owners (ON DELETE RESTRICT)
    let ownerships: Array<{ id: string; property_id: string; owner_id: string }> = []
    if (owners.length > 0) {
      console.log('\nStep 3: Deleting ownerships...')
      const ownerIds = owners.map(o => o.id)
      
      const { data: ownershipsData, error: ownershipsError } = await supabase
        .from('ownerships')
        .select('id, property_id, owner_id')
        .in('owner_id', ownerIds)

      if (ownershipsError) {
        throw new Error(`Error finding ownerships: ${ownershipsError.message}`)
      }

      ownerships = ownershipsData || []
      console.log(`Found ${ownerships.length} ownership record(s)`)
      
      if (ownerships.length > 0) {
        const { error: deleteOwnershipsError } = await supabase
          .from('ownerships')
          .delete()
          .in('owner_id', ownerIds)

        if (deleteOwnershipsError) {
          throw new Error(`Error deleting ownerships: ${deleteOwnershipsError.message}`)
        }
        console.log(`Deleted ${ownerships.length} ownership record(s)`)
      }
    }

    // Step 4: Find tenants linked to this contact
    console.log('\nStep 4: Finding tenant records...')
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, contact_id')
      .eq('contact_id', contactId)

    if (tenantsError) {
      throw new Error(`Error finding tenants: ${tenantsError.message}`)
    }

    console.log(`Found ${tenants.length} tenant(s) linked to contact ${contactId}`)

    // Step 5: Delete lease_contacts for these tenants
    let leaseContacts: Array<{ id: string; tenant_id: string }> = []
    if (tenants.length > 0) {
      console.log('\nStep 5: Deleting lease_contacts...')
      const tenantIds = tenants.map(t => t.id)
      
      const { data: leaseContactsData, error: leaseContactsError } = await supabase
        .from('lease_contacts')
        .select('id, tenant_id')
        .in('tenant_id', tenantIds)

      if (leaseContactsError) {
        throw new Error(`Error finding lease_contacts: ${leaseContactsError.message}`)
      }

      leaseContacts = leaseContactsData || []
      console.log(`Found ${leaseContacts.length} lease_contact record(s)`)
      
      if (leaseContacts.length > 0) {
        const { error: deleteLeaseContactsError } = await supabase
          .from('lease_contacts')
          .delete()
          .in('tenant_id', tenantIds)

        if (deleteLeaseContactsError) {
          throw new Error(`Error deleting lease_contacts: ${deleteLeaseContactsError.message}`)
        }
        console.log(`Deleted ${leaseContacts.length} lease_contact record(s)`)
      }
    }

    // Step 6: Check for vendors linked to this contact
    console.log('\nStep 6: Checking vendors...')
    const { data: vendors, error: vendorsError } = await supabase
      .from('vendors')
      .select('id, contact_id')
      .eq('contact_id', contactId)

    if (vendorsError) {
      throw new Error(`Error finding vendors: ${vendorsError.message}`)
    }

    console.log(`Found ${vendors.length} vendor(s) linked to contact ${contactId}`)
    
    if (vendors.length > 0) {
      // Vendors contact_id might be nullable, so we can set it to NULL instead of deleting
      console.log('Setting vendor contact_id to NULL...')
      const { error: updateVendorsError } = await supabase
        .from('vendors')
        .update({ contact_id: null })
        .eq('contact_id', contactId)

      if (updateVendorsError) {
        throw new Error(`Error updating vendors: ${updateVendorsError.message}`)
      }
      console.log(`Updated ${vendors.length} vendor(s)`)
    }

    // Step 7: Check for tasks (requested_by_contact_id will be set to NULL automatically)
    console.log('\nStep 7: Checking tasks...')
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, requested_by_contact_id')
      .eq('requested_by_contact_id', contactId)

    if (tasksError) {
      throw new Error(`Error finding tasks: ${tasksError.message}`)
    }

    console.log(`Found ${tasks.length} task(s) linked to contact ${contactId} (will be set to NULL automatically)`)

    // Step 8: Delete the contact (this will CASCADE delete owners and tenants)
    console.log('\nStep 8: Deleting contact...')
    const { error: deleteContactError } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId)

    if (deleteContactError) {
      throw new Error(`Error deleting contact: ${deleteContactError.message}`)
    }

    console.log(`\n✅ Successfully deleted contact ${contactId} and all linked records!`)
    console.log(`\nSummary:`)
    console.log(`  - Contact: ${contactId}`)
    if (owners.length > 0) {
      console.log(`  - Owners: ${owners.length} (including "Test First Test Last")`)
      if (ownerships.length > 0) {
        console.log(`  - Ownerships: ${ownerships.length}`)
      }
    }
    if (tenants.length > 0) {
      console.log(`  - Tenants: ${tenants.length}`)
      if (leaseContacts.length > 0) {
        console.log(`  - Lease Contacts: ${leaseContacts.length}`)
      }
    }
    if (vendors.length > 0) {
      console.log(`  - Vendors updated: ${vendors.length}`)
    }
    if (tasks.length > 0) {
      console.log(`  - Tasks (contact_id set to NULL): ${tasks.length}`)
    }

  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

deleteContact31()

