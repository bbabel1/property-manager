import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyOwnerCreated() {
  try {
    // Check the contact record
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', 10)
      .single()

    if (contactError) {
      console.error('Error fetching contact:', contactError)
      return
    }

    console.log('Contact Record:')
    console.log('ID:', contact.id)
    console.log('Name:', `${contact.first_name} ${contact.last_name}`)
    console.log('Email:', contact.primary_email)
    console.log('Phone:', contact.primary_phone)
    console.log('Address:', `${contact.primary_address_line_1}, ${contact.primary_city}, ${contact.primary_state} ${contact.primary_postal_code}`)
    console.log('Is Company:', contact.is_company)
    console.log('Created:', contact.created_at)

    // Check the owner record
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .select('*')
      .eq('id', '154c61d8-cec8-4fa3-8948-babda42544bf')
      .single()

    if (ownerError) {
      console.error('Error fetching owner:', ownerError)
      return
    }

    console.log('\nOwner Record:')
    console.log('ID:', owner.id)
    console.log('Contact ID:', owner.contact_id)
    console.log('Buildium Owner ID:', owner.buildium_owner_id)
    console.log('Management Start Date:', owner.management_agreement_start_date)
    console.log('Management End Date:', owner.management_agreement_end_date)
    console.log('Comment:', owner.comment)
    console.log('Tax Address:', `${owner.tax_address_line_1}, ${owner.tax_address_line_2 || ''}`)
    console.log('Created:', owner.created_at)

    // Check the ownership record
    const { data: ownership, error: ownershipError } = await supabase
      .from('ownerships')
      .select('*')
      .eq('id', '4fef279e-670f-4e51-a54f-f05f2c7aada7')
      .single()

    if (ownershipError) {
      console.error('Error fetching ownership:', ownershipError)
      return
    }

    console.log('\nOwnership Record:')
    console.log('ID:', ownership.id)
    console.log('Property ID:', ownership.property_id)
    console.log('Owner ID:', ownership.owner_id)
    console.log('Primary:', ownership.primary)
    console.log('Ownership Percentage:', ownership.ownership_percentage)
    console.log('Disbursement Percentage:', ownership.disbursement_percentage)
    console.log('Created:', ownership.created_at)

    // Check the property to confirm the relationship
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', '5c75005a-f75f-40a9-b492-ff0342001ee1')
      .single()

    if (propertyError) {
      console.error('Error fetching property:', propertyError)
      return
    }

    console.log('\nProperty Record:')
    console.log('ID:', property.id)
    console.log('Name:', property.name)
    console.log('Buildium Property ID:', property.buildium_property_id)
    console.log('Address:', `${property.address_line1}, ${property.city}, ${property.state} ${property.postal_code}`)

    // Check all ownerships for this property
    const { data: propertyOwnerships, error: propertyOwnershipsError } = await supabase
      .from('ownerships')
      .select(`
        *,
        owners (
          id,
          contact_id,
          contacts (
            first_name,
            last_name,
            primary_email
          )
        )
      `)
      .eq('property_id', '5c75005a-f75f-40a9-b492-ff0342001ee1')

    if (propertyOwnershipsError) {
      console.error('Error fetching property ownerships:', propertyOwnershipsError)
      return
    }

    console.log('\nProperty Ownerships:')
    propertyOwnerships.forEach((ownership, index) => {
      console.log(`Ownership ${index + 1}:`)
      console.log('  Owner:', `${ownership.owners.contacts.first_name} ${ownership.owners.contacts.last_name}`)
      console.log('  Email:', ownership.owners.contacts.primary_email)
      console.log('  Primary:', ownership.primary)
      console.log('  Ownership %:', ownership.ownership_percentage)
      console.log('  Disbursement %:', ownership.disbursement_percentage)
    })

  } catch (error) {
    console.error('Error:', error)
  }
}

verifyOwnerCreated()
