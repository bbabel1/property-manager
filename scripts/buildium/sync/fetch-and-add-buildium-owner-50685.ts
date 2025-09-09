import { createClient } from '@supabase/supabase-js'
import { mapOwnerFromBuildium, findOrCreateOwnerContact } from '@/lib/buildium-mappers'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
  Comment: string
  Address: {
    AddressLine1: string
    AddressLine2: string
    AddressLine3: string
    City: string
    State: string
    PostalCode: string
    Country: string
  }
  ManagementAgreementStartDate: string
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
      AddressLine2: string
      AddressLine3: string
      City: string
      State: string
      PostalCode: string
      Country: string
    }
  }
}

async function fetchBuildiumOwner(ownerId: number): Promise<BuildiumOwner> {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/owners/${ownerId}`
  
  try {
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Buildium API error: ${response.status} ${response.statusText}`)
      console.error('Error response:', errorText)
      throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log('Owner data from Buildium:', JSON.stringify(data, null, 2))
    return data
  } catch (error) {
    console.error('Error fetching owner from Buildium:', error)
    throw error
  }
}

async function fetchAndAddBuildiumOwner(ownerId: number) {
  try {
    console.log(`🔍 Fetching Buildium owner ${ownerId}...`)

    // Fetch owner from Buildium
    const buildiumOwner = await fetchBuildiumOwner(ownerId)
    console.log('✅ Successfully fetched owner from Buildium:', buildiumOwner.FirstName, buildiumOwner.LastName)

    // Check if owner already exists in database
    const { data: existingOwners, error: checkError } = await supabase
      .from('owners')
      .select('*')
      .eq('buildium_owner_id', ownerId)

    if (checkError) {
      console.error('❌ Error checking existing owner:', checkError)
      throw checkError
    }

    if (existingOwners && existingOwners.length > 0) {
      console.log('⚠️ Owner already exists in database:', existingOwners[0].id)
      return existingOwners[0].id
    }

    // Create contact record first
    console.log('🔄 Creating contact record...')
    const contactId = await findOrCreateOwnerContact(buildiumOwner, supabase)
    console.log('✅ Contact created/found with ID:', contactId)

    // Map owner data manually to match the actual schema
    console.log('🔄 Mapping owner data...')
    const localData = {
      management_agreement_start_date: buildiumOwner.ManagementAgreementStartDate,
      management_agreement_end_date: buildiumOwner.ManagementAgreementEndDate,
      comment: buildiumOwner.Comment,
      tax_payer_name1: buildiumOwner.TaxInformation.TaxPayerName1,
      tax_payer_name2: buildiumOwner.TaxInformation.TaxPayerName2,
      tax_address_line1: buildiumOwner.TaxInformation.Address.AddressLine1,
      tax_address_line2: buildiumOwner.TaxInformation.Address.AddressLine2,
      tax_address_line3: buildiumOwner.TaxInformation.Address.AddressLine3,
      tax_city: buildiumOwner.TaxInformation.Address.City,
      tax_state: buildiumOwner.TaxInformation.Address.State,
      tax_postal_code: buildiumOwner.TaxInformation.Address.PostalCode,
      tax_country: buildiumOwner.TaxInformation.Address.Country === 'UnitedStates' ? 'United States' : buildiumOwner.TaxInformation.Address.Country,
      tax_payer_id: buildiumOwner.TaxInformation.TaxPayerId,
      tax_payer_type: buildiumOwner.TaxInformation.TaxPayerIdType,
      tax_include1099: buildiumOwner.TaxInformation.IncludeIn1099,
      is_active: buildiumOwner.IsActive,
      buildium_owner_id: buildiumOwner.Id,
      buildium_created_at: null, // Not available in the API response
      buildium_updated_at: null, // Not available in the API response
      contact_id: contactId
    }
    
    // Add required timestamp fields
    const now = new Date().toISOString()
    const finalData = {
      ...localData,
      created_at: now,
      updated_at: now
    }

    console.log('📋 Mapped owner data:', finalData)

    // Insert new owner
    console.log(`➕ Creating new owner in database...`)
    const { data: newOwner, error: insertError } = await supabase
      .from('owners')
      .insert(finalData)
      .select()
      .single()
    
    if (insertError) {
      console.error('❌ Error inserting owner:', insertError)
      throw insertError
    }
    
    console.log('✅ Successfully added new owner to database:', newOwner.id)

    console.log('🎉 Owner sync completed successfully!')
    console.log('📊 Owner details:')
    console.log(`   - Local ID: ${newOwner.id}`)
    console.log(`   - Buildium ID: ${newOwner.buildium_owner_id}`)
    console.log(`   - Name: ${newOwner.first_name} ${newOwner.last_name}`)
    console.log(`   - Company: ${newOwner.company_name || 'N/A'}`)
    console.log(`   - Email: ${newOwner.email}`)
    console.log(`   - Phone: ${newOwner.phone || 'N/A'}`)
    console.log(`   - Address: ${newOwner.address_line1}, ${newOwner.city}, ${newOwner.state}`)
    console.log(`   - Contact ID: ${newOwner.contact_id}`)
    console.log(`   - Status: ${newOwner.is_active ? 'Active' : 'Inactive'}`)

    return newOwner.id

  } catch (error) {
    console.error('❌ Failed to fetch and add owner:', error)
    throw error
  }
}

// Run the script
if (require.main === module) {
  const args = process.argv.slice(2)
  const ownerId = args[0] ? parseInt(args[0]) : 50685
  
  if (!ownerId || isNaN(ownerId)) {
    console.error('❌ Invalid owner ID. Please provide a valid number.')
    console.log('Usage: npx tsx scripts/buildium/sync/fetch-and-add-buildium-owner-50685.ts <ownerId>')
    process.exit(1)
  }
  
  fetchAndAddBuildiumOwner(ownerId)
    .then(() => {
      console.log('🎯 Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Script failed:', error)
      process.exit(1)
    })
}

export { fetchAndAddBuildiumOwner }
