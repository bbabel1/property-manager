import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { logger } from './utils/logger'

// Load environment variables
config()

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const ownerId = '50685'
const propertyId = '7647'

interface BuildiumOwner {
  Id: number
  IsCompany: boolean
  IsActive: boolean
  FirstName: string
  LastName: string
  PhoneNumbers: Array<{
    Number: string
    Type: string
  }>
  Email: string
  AlternateEmail?: string
  Comment?: string
  Address: {
    AddressLine1: string
    AddressLine2?: string
    AddressLine3?: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
  ManagementAgreementStartDate?: string
  ManagementAgreementEndDate?: string
  CompanyName?: string
  PropertyIds: number[]
  TaxInformation: {
    TaxPayerIdType: string
    TaxPayerId: string
    TaxPayerName1: string
    TaxPayerName2?: string
    IncludeIn1099: boolean
    Address: {
      AddressLine1: string
      AddressLine2?: string
      AddressLine3?: string
      City: string
      State: string
      PostalCode: string
      Country: string
    }
  }
}

async function fetchOwnerFromBuildium(ownerId: string): Promise<BuildiumOwner> {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/owners/${ownerId}`
  
  try {
    const response = await fetch(buildiumUrl, {
      headers: {
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    logger.info(`Successfully fetched owner ${ownerId} from Buildium`)
    return data
  } catch (error) {
    logger.error('Error fetching owner from Buildium:', error)
    throw error
  }
}

async function getLocalPropertyId(buildiumPropertyId: string): Promise<string> {
  const { data: property, error } = await supabase
    .from('properties')
    .select('id')
    .eq('buildium_property_id', buildiumPropertyId)
    .single()

  if (error) {
    logger.error('Error finding local property:', error)
    throw error
  }

  if (!property) {
    throw new Error(`No local property found for Buildium property ID ${buildiumPropertyId}`)
  }

  return property.id
}

async function createContactRecord(buildiumOwner: BuildiumOwner) {
  try {
    // Map phone numbers
    const phoneNumbers = buildiumOwner.PhoneNumbers || []
    const homePhone = phoneNumbers.find(p => p.Type === 'Home')?.Number
    const workPhone = phoneNumbers.find(p => p.Type === 'Work')?.Number
    const mobilePhone = phoneNumbers.find(p => p.Type === 'Cell')?.Number
    const faxPhone = phoneNumbers.find(p => p.Type === 'Fax')?.Number

    const contactData = {
      is_company: buildiumOwner.IsCompany,
      first_name: buildiumOwner.FirstName,
      last_name: buildiumOwner.LastName,
      company_name: buildiumOwner.CompanyName || null,
      primary_email: buildiumOwner.Email,
      alt_email: buildiumOwner.AlternateEmail || null,
      primary_phone: mobilePhone || homePhone || workPhone || null,
      alt_phone: workPhone || homePhone || null,
      date_of_birth: null, // Not provided in Buildium data
      primary_address_line_1: buildiumOwner.Address.AddressLine1,
      primary_address_line_2: buildiumOwner.Address.AddressLine2 || null,
      primary_address_line_3: buildiumOwner.Address.AddressLine3 || null,
      primary_city: buildiumOwner.Address.City,
      primary_state: buildiumOwner.Address.State,
      primary_postal_code: buildiumOwner.Address.PostalCode,
      primary_country: buildiumOwner.Address.Country,
      alt_address_line_1: null,
      alt_address_line_2: null,
      alt_address_line_3: null,
      alt_city: null,
      alt_state: null,
      alt_postal_code: null,
      alt_country: null,
      mailing_preference: 'primary',
      updated_at: new Date().toISOString()
    }

    console.log('Creating contact with data:', {
      firstName: contactData.first_name,
      lastName: contactData.last_name,
      email: contactData.primary_email,
      primaryPhone: contactData.primary_phone
    })

    // Insert contact
    const { data: createdContact, error } = await supabase
      .from('contacts')
      .insert(contactData)
      .select()
      .single()

    if (error) {
      console.error('Error creating contact:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      throw error
    }

    logger.info('Successfully created contact:', {
      id: createdContact.id,
      name: `${createdContact.first_name} ${createdContact.last_name}`,
      email: createdContact.primary_email
    })

    return createdContact
  } catch (error) {
    logger.error('Contact creation failed:', error)
    throw error
  }
}

async function createOwnerRecord(contactId: number, buildiumOwner: BuildiumOwner) {
  try {
    const ownerData = {
      contact_id: contactId,
      buildium_owner_id: buildiumOwner.Id,
      management_agreement_start_date: buildiumOwner.ManagementAgreementStartDate || null,
      management_agreement_end_date: buildiumOwner.ManagementAgreementEndDate || null,
      comment: buildiumOwner.Comment || null,
      etf_account_type: null,
      etf_account_number: null,
      etf_routing_number: null,
      tax_address_line_1: buildiumOwner.TaxInformation.Address.AddressLine1,
      tax_address_line_2: buildiumOwner.TaxInformation.Address.AddressLine2 || null,
      tax_address_line_3: buildiumOwner.TaxInformation.Address.AddressLine3 || null,
      updated_at: new Date().toISOString()
    }

    console.log('Creating owner with data:', {
      contactId: ownerData.contact_id,
      startDate: ownerData.management_agreement_start_date,
      endDate: ownerData.management_agreement_end_date
    })

    // Insert owner
    const { data: createdOwner, error } = await supabase
      .from('owners')
      .insert(ownerData)
      .select()
      .single()

    if (error) {
      console.error('Error creating owner:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      throw error
    }

    logger.info('Successfully created owner:', {
      id: createdOwner.id,
      contactId: createdOwner.contact_id
    })

    return createdOwner
  } catch (error) {
    logger.error('Owner creation failed:', error)
    throw error
  }
}

async function createOwnershipRecord(ownerId: string, propertyId: string) {
  try {
    const ownershipData = {
      property_id: propertyId,
      owner_id: ownerId,
      primary: true, // First owner is primary
      ownership_percentage: 100.00, // 100% ownership
      disbursement_percentage: 100.00, // 100% disbursement
      updated_at: new Date().toISOString()
    }

    console.log('Creating ownership with data:', {
      propertyId: ownershipData.property_id,
      ownerId: ownershipData.owner_id,
      primary: ownershipData.primary,
      ownershipPercentage: ownershipData.ownership_percentage
    })

    // Insert ownership
    const { data: createdOwnership, error } = await supabase
      .from('ownerships')
      .insert(ownershipData)
      .select()
      .single()

    if (error) {
      console.error('Error creating ownership:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      throw error
    }

    logger.info('Successfully created ownership:', {
      id: createdOwnership.id,
      propertyId: createdOwnership.property_id,
      ownerId: createdOwnership.owner_id
    })

    return createdOwnership
  } catch (error) {
    logger.error('Ownership creation failed:', error)
    throw error
  }
}

async function main() {
  try {
    logger.info('Starting owner creation process for Buildium owner 50685...')
    
    // 1. Fetch owner from Buildium
    const buildiumOwner = await fetchOwnerFromBuildium(ownerId)
    console.log('Buildium owner data:', {
      id: buildiumOwner.Id,
      name: `${buildiumOwner.FirstName} ${buildiumOwner.LastName}`,
      email: buildiumOwner.Email,
      propertyIds: buildiumOwner.PropertyIds
    })
    
    // 2. Get local property ID
    const localPropertyId = await getLocalPropertyId(propertyId)
    logger.info(`Found local property ID: ${localPropertyId}`)
    
    // 3. Create contact record
    const contact = await createContactRecord(buildiumOwner)
    
    // 4. Create owner record
    const owner = await createOwnerRecord(contact.id, buildiumOwner)
    
    // 5. Create ownership record
    const ownership = await createOwnershipRecord(owner.id, localPropertyId)
    
    logger.info('Owner creation process completed successfully!')
    console.log('\nSummary:')
    console.log('Contact ID:', contact.id)
    console.log('Owner ID:', owner.id)
    console.log('Ownership ID:', ownership.id)
    console.log('Property ID:', localPropertyId)
    
  } catch (error) {
    logger.error('Owner creation process failed:', error)
    process.exit(1)
  }
}

main()
