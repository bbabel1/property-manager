import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mapLeaseFromBuildiumWithTenants, createLeaseContactRelationship } from '@/lib/buildium-mappers'

// Load environment variables
config({ path: '.env.local' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const buildiumLeaseId = '16235'

interface BuildiumTenant {
  Id: number
  FirstName: string
  LastName: string
  Email: string
  AlternateEmail?: string
  PhoneNumbers: Array<{
    Number: string
    Type: string
  }>
  CreatedDateTime: string
  EmergencyContact: {
    Name: string
    RelationshipDescription: string
    Phone: string
    Email: string
  }
  DateOfBirth: string
  SMSOptInStatus: string
  Address: {
    AddressLine1: string
    AddressLine2: string
    AddressLine3: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
  AlternateAddress?: any
  MailingPreference: string
  Leases?: any
  Comment: string
  TaxId: string
}

interface BuildiumLease {
  Id: number
  PropertyId: number
  UnitId: number
  UnitNumber: string
  LeaseFromDate: string
  LeaseToDate: string
  LeaseType: string
  LeaseStatus: string
  IsEvictionPending: boolean
  TermType: string
  RenewalOfferStatus: string
  CurrentTenants: BuildiumTenant[]
  CurrentNumberOfOccupants: number
  AccountDetails: {
    SecurityDeposit: number
    Rent: number
  }
  Cosigners: any[]
  AutomaticallyMoveOutTenants: boolean
  CreatedDateTime: string
  LastUpdatedDateTime: string
  MoveOutData: any[]
  PaymentDueDay: number
  Tenants: Array<{
    Id: number
    Status: string
    MoveInDate: string
  }>
}

async function fetchLeaseFromBuildium(leaseId: string): Promise<BuildiumLease> {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/${leaseId}`
  
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
    console.log(`✅ Successfully fetched lease ${leaseId} from Buildium`)
    return data
  } catch (error) {
    console.error('❌ Error fetching lease from Buildium:', error)
    throw error
  }
}

async function getLocalPropertyId(buildiumPropertyId: number): Promise<string> {
  const { data: property, error } = await supabase
    .from('properties')
    .select('id')
    .eq('buildium_property_id', buildiumPropertyId)
    .single()

  if (error) {
    throw new Error(`Error finding property with Buildium ID ${buildiumPropertyId}: ${error.message}`)
  }

  return property.id
}

async function getLocalUnitId(buildiumUnitId: number): Promise<string> {
  const { data: unit, error } = await supabase
    .from('units')
    .select('id')
    .eq('buildium_unit_id', buildiumUnitId)
    .single()

  if (error) {
    throw new Error(`Error finding unit with Buildium ID ${buildiumUnitId}: ${error.message}`)
  }

  return unit.id
}

async function createContactRecord(buildiumTenant: BuildiumTenant): Promise<number> {
  try {
    const mobilePhone = buildiumTenant.PhoneNumbers?.find(p => p.Type === 'Cell')?.Number || null
    const homePhone = buildiumTenant.PhoneNumbers?.find(p => p.Type === 'Home')?.Number || null
    const workPhone = buildiumTenant.PhoneNumbers?.find(p => p.Type === 'Work')?.Number || null

    const contactData = {
      is_company: false,
      first_name: buildiumTenant.FirstName,
      last_name: buildiumTenant.LastName,
      company_name: null,
      primary_email: buildiumTenant.Email,
      alt_email: buildiumTenant.AlternateEmail || null,
      primary_phone: mobilePhone || homePhone || workPhone || null,
      alt_phone: workPhone || homePhone || null,
      date_of_birth: buildiumTenant.DateOfBirth || null,
      primary_address_line_1: buildiumTenant.Address.AddressLine1,
      primary_address_line_2: buildiumTenant.Address.AddressLine2 || null,
      primary_address_line_3: buildiumTenant.Address.AddressLine3 || null,
      primary_city: buildiumTenant.Address.City,
      primary_state: buildiumTenant.Address.State,
      primary_postal_code: buildiumTenant.Address.PostalCode,
      primary_country: buildiumTenant.Address.Country,
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

    const { data: contact, error } = await supabase
      .from('contacts')
      .insert(contactData)
      .select('id')
      .single()

    if (error) {
      console.error('Error creating contact:', error)
      console.error('Attempted data:', contactData)
      throw error
    }

    console.log(`✅ Created contact record with ID: ${contact.id}`)
    return contact.id
  } catch (error) {
    console.error('❌ Failed to create contact record:', error)
    throw error
  }
}

async function createTenantRecord(contactId: number, buildiumTenant: BuildiumTenant): Promise<string> {
  try {
    const tenantData = {
      contact_id: contactId,
      buildium_tenant_id: buildiumTenant.Id,
      move_in_date: buildiumTenant.DateOfBirth ? new Date(buildiumTenant.DateOfBirth).toISOString().split('T')[0] : null,
      move_out_date: null,
      is_rent_responsible: true, // Default to true for primary tenant
      emergency_contact_name: buildiumTenant.EmergencyContact?.Name || null,
      emergency_contact_relationship: buildiumTenant.EmergencyContact?.RelationshipDescription || null,
      emergency_contact_phone: buildiumTenant.EmergencyContact?.Phone || null,
      emergency_contact_email: buildiumTenant.EmergencyContact?.Email || null,
      sms_opt_in_status: buildiumTenant.SMSOptInStatus || null,
      comment: buildiumTenant.Comment || null,
      tax_id: buildiumTenant.TaxId || null,
      updated_at: new Date().toISOString()
    }

    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert(tenantData)
      .select('id')
      .single()

    if (error) {
      console.error('Error creating tenant:', error)
      console.error('Attempted data:', tenantData)
      throw error
    }

    console.log(`✅ Created tenant record with ID: ${tenant.id}`)
    return tenant.id
  } catch (error) {
    console.error('❌ Failed to create tenant record:', error)
    throw error
  }
}

async function createLeaseRecord(buildiumLease: BuildiumLease, localPropertyId: string, localUnitId: string): Promise<number> {
  try {
    // Use the enhanced mapper function with tenant processing
    const enhancedLease = await mapLeaseFromBuildiumWithTenants(buildiumLease, supabase)
    
    const leaseData = {
      propertyId: localPropertyId,
      unitId: localUnitId,
      ...enhancedLease,
      // Remove tenantRelationships as it's not part of lease table
      tenantRelationships: undefined,
      updatedAt: new Date().toISOString()
    }

    const { data: lease, error } = await supabase
      .from('lease')
      .insert(leaseData)
      .select('id')
      .single()

    if (error) {
      console.error('Error creating lease:', error)
      console.error('Attempted data:', leaseData)
      throw error
    }

    console.log(`✅ Created lease record with ID: ${lease.id}`)
    
    // Create lease_contacts relationships
    if (enhancedLease.tenantRelationships) {
      for (const relationship of enhancedLease.tenantRelationships) {
        await createLeaseContactRelationship(lease.id, relationship.tenantId, relationship.role, supabase)
      }
    }
    
    return lease.id
  } catch (error) {
    console.error('❌ Failed to create lease record:', error)
    throw error
  }
}

async function createLeaseContactRecord(leaseId: number, tenantId: string, buildiumTenant: BuildiumTenant, tenantInfo: any): Promise<string> {
  try {
    const leaseContactData = {
      lease_id: leaseId,
      tenant_id: tenantId,
      role: 'Tenant',
      status: tenantInfo.Status,
      move_in_date: tenantInfo.MoveInDate,
      is_rent_responsible: true, // Default to true for primary tenant
      updated_at: new Date().toISOString()
    }

    const { data: leaseContact, error } = await supabase
      .from('lease_contacts')
      .insert(leaseContactData)
      .select('id')
      .single()

    if (error) {
      console.error('Error creating lease contact:', error)
      console.error('Attempted data:', leaseContactData)
      throw error
    }

    console.log(`✅ Created lease contact record with ID: ${leaseContact.id}`)
    return leaseContact.id
  } catch (error) {
    console.error('❌ Failed to create lease contact record:', error)
    throw error
  }
}

async function main() {
  try {
    console.log(`🔍 Fetching lease ${buildiumLeaseId} from Buildium...`)
    const buildiumLease = await fetchLeaseFromBuildium(buildiumLeaseId)
    
    console.log('🔍 Getting local property and unit IDs...')
    const localPropertyId = await getLocalPropertyId(buildiumLease.PropertyId)
    const localUnitId = await getLocalUnitId(buildiumLease.UnitId)
    
    console.log('📝 Creating lease record with enhanced tenant processing...')
    const localLeaseId = await createLeaseRecord(buildiumLease, localPropertyId, localUnitId)
    
    console.log('✅ Successfully created lease with all tenant relationships!')
    console.log('Lease ID:', localLeaseId)
    
  } catch (error) {
    console.error('❌ Failed to create lease records:', error)
    console.error('Full error details:', error)
    process.exit(1)
  }
}

main()
