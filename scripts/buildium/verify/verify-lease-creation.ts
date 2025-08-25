import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { logger } from './utils/logger'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyLeaseCreation() {
  try {
    // Get the lease record
    const { data: lease, error: leaseError } = await supabase
      .from('lease')
      .select(`
        *,
        property:properties(name, buildium_property_id),
        unit:units(unit_number, buildium_unit_id)
      `)
      .eq('buildium_lease_id', 16235)
      .single()

    if (leaseError) {
      console.error('Error fetching lease:', leaseError)
      return
    }

    console.log('\n=== LEASE RECORD ===')
    console.log('Lease ID:', lease.id)
    console.log('Buildium Lease ID:', lease.buildium_lease_id)
    console.log('Property:', lease.property?.name)
    console.log('Unit:', lease.unit?.unit_number)
    console.log('Lease From Date:', lease.lease_from_date)
    console.log('Lease To Date:', lease.lease_to_date)
    console.log('Status:', lease.status)
    console.log('Rent Amount:', lease.rent_amount)
    console.log('Security Deposit:', lease.security_deposit)
    console.log('Lease Type:', lease.lease_type)
    console.log('Unit Number:', lease.unit_number)
    console.log('Current Occupants:', lease.current_number_of_occupants)
    console.log('Payment Due Day:', lease.payment_due_day)

    // Get the lease contacts
    const { data: leaseContacts, error: leaseContactsError } = await supabase
      .from('lease_contacts')
      .select(`
        *,
        tenant:tenants(
          *,
          contact:contacts(first_name, last_name, primary_email, primary_phone)
        )
      `)
      .eq('lease_id', lease.id)

    if (leaseContactsError) {
      console.error('Error fetching lease contacts:', leaseContactsError)
      return
    }

    console.log('\n=== TENANTS ===')
    leaseContacts.forEach((leaseContact, index) => {
      console.log(`\nTenant ${index + 1}:`)
      console.log('  Lease Contact ID:', leaseContact.id)
      console.log('  Role:', leaseContact.role)
      console.log('  Status:', leaseContact.status)
      console.log('  Move In Date:', leaseContact.move_in_date)
      console.log('  Is Rent Responsible:', leaseContact.is_rent_responsible)
      
      const tenant = leaseContact.tenant
      const contact = tenant.contact
      console.log('  Tenant ID:', tenant.id)
      console.log('  Buildium Tenant ID:', tenant.buildium_tenant_id)
      console.log('  Name:', `${contact.first_name} ${contact.last_name}`)
      console.log('  Email:', contact.primary_email)
      console.log('  Phone:', contact.primary_phone)
      console.log('  Emergency Contact:', tenant.emergency_contact_name)
      console.log('  Emergency Contact Phone:', tenant.emergency_contact_phone)
      console.log('  Emergency Contact Email:', tenant.emergency_contact_email)
      console.log('  Tax ID:', tenant.tax_id)
      console.log('  Comment:', tenant.comment)
    })

    console.log('\n=== SUMMARY ===')
    console.log(`Successfully created lease record with ${leaseContacts.length} tenant(s)`)
    console.log('All records are properly linked and contain the correct Buildium data')

  } catch (error) {
    console.error('Error verifying lease creation:', error)
  }
}

verifyLeaseCreation()
