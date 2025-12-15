import { createClient } from '@supabase/supabase-js'
import { findOrCreateContact, findOrCreateTenant } from '@/lib/buildium-mappers'
import { rateLimitedBuildiumRequest } from '@/lib/buildium-rate-limiter'
import type { BuildiumTenant } from '@/types/buildium'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fetchTenantFromBuildium(tenantId: number): Promise<BuildiumTenant> {
  console.log(`🔍 Fetching tenant ${tenantId} directly from Buildium API...`)
  
  return rateLimitedBuildiumRequest(async () => {
    // Use the correct endpoint: /leases/tenants/{id}
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/tenants/${tenantId}`
    
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch tenant from Buildium: ${response.status} ${response.statusText}`)
    }

    const tenant = await response.json()
    return tenant
  })
}

async function fetchTenantFromLease(tenantId: number): Promise<BuildiumTenant> {
  console.log(`🔍 Fallback: Fetching tenant ${tenantId} data from lease 16235...`)
  
  return rateLimitedBuildiumRequest(async () => {
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/16235`
    
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch lease from Buildium: ${response.status} ${response.statusText}`)
    }

    const lease = await response.json()
    
    // Find the tenant in the CurrentTenants array
    const tenant = lease.CurrentTenants?.find((t: any) => t.Id === tenantId)
    
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found in lease 16235`)
    }

    return tenant
  })
}

async function createLeaseContactRelationship(tenantId: string, supabase: any): Promise<string> {
  try {
    // Get the lease ID for Buildium lease 16235 (the lease this tenant is associated with)
    const { data: lease, error: leaseError } = await supabase
      .from('lease')
      .select('id')
      .eq('buildium_lease_id', 16235)
      .single()

    if (leaseError) {
      console.error('❌ Error finding lease:', leaseError)
      throw leaseError
    }

    // Check if lease_contact relationship already exists
    const { data: existingRelationship, error: checkError } = await supabase
      .from('lease_contacts')
      .select('*')
      .eq('lease_id', lease.id)
      .eq('tenant_id', tenantId)

    if (checkError) {
      console.error('❌ Error checking existing relationship:', checkError)
      throw checkError
    }

    if (existingRelationship && existingRelationship.length > 0) {
      console.log('⚠️ Lease_contact relationship already exists:', existingRelationship[0].id)
      return existingRelationship[0].id
    }

    // Create the lease_contact relationship
    const leaseContactData = {
      lease_id: lease.id,
      tenant_id: tenantId,
      role: 'Tenant',
      status: 'Active',
      move_in_date: '2025-08-23', // From the lease data we saw earlier
      is_rent_responsible: true,
      updated_at: new Date().toISOString()
    }

    const { data: newRelationship, error: createError } = await supabase
      .from('lease_contacts')
      .insert(leaseContactData)
      .select('id')
      .single()

    if (createError) {
      console.error('❌ Error creating lease_contact relationship:', createError)
      throw createError
    }

    console.log('✅ Created lease_contact relationship:', newRelationship.id)
    return newRelationship.id

  } catch (error) {
    console.error('❌ Failed to create lease_contact relationship:', error)
    throw error
  }
}

async function fetchAndAddBuildiumTenant(tenantId: number) {
  try {
    console.log(`🔍 Fetching Buildium tenant ${tenantId}...`)
    
    let buildiumTenant: BuildiumTenant
    
    try {
      buildiumTenant = await fetchTenantFromBuildium(tenantId)
      console.log('✅ Successfully fetched tenant from Buildium:', buildiumTenant.FirstName, buildiumTenant.LastName)
    } catch (error) {
      console.log('⚠️ Direct tenant fetch failed, trying fallback method...')
      buildiumTenant = await fetchTenantFromLease(tenantId)
      console.log('✅ Successfully fetched tenant from lease fallback:', buildiumTenant.FirstName, buildiumTenant.LastName)
    }

    // Check if tenant already exists
    const { data: existingTenants, error: checkError } = await supabase
      .from('tenants')
      .select('*')
      .eq('buildium_tenant_id', tenantId)

    if (checkError) {
      console.error('❌ Error checking existing tenant:', checkError)
      throw checkError
    }

    if (existingTenants && existingTenants.length > 0) {
      console.log('⚠️ Tenant already exists in database:', existingTenants[0].id)
      return existingTenants[0].id
    }

    console.log('🔄 Creating contact record...')
    const contactId = await findOrCreateContact(buildiumTenant, supabase)
    console.log('✅ Contact created/found with ID:', contactId)

    console.log('🔄 Creating tenant record...')
    const localTenantId = await findOrCreateTenant(contactId, buildiumTenant, supabase)
    console.log('✅ Tenant created/found with ID:', localTenantId)

    // Create lease_contact relationship if tenant is associated with a lease
    console.log('🔄 Creating lease_contact relationship...')
    const leaseContactId = await createLeaseContactRelationship(localTenantId, supabase)
    console.log('✅ Lease_contact relationship created/found with ID:', leaseContactId)

    const phoneEntries = Array.isArray(buildiumTenant.PhoneNumbers)
      ? buildiumTenant.PhoneNumbers
      : buildiumTenant.PhoneNumbers
        ? [
            { Number: buildiumTenant.PhoneNumbers.Home, Type: 'Home' },
            { Number: buildiumTenant.PhoneNumbers.Work, Type: 'Work' },
            { Number: buildiumTenant.PhoneNumbers.Mobile, Type: 'Cell' },
          ].filter((p) => p.Number)
        : []
    const displayPhone = phoneEntries[0]?.Number || 'N/A'
    const primaryAddress = buildiumTenant.PrimaryAddress || (buildiumTenant as any).Address
    const addressString = primaryAddress
      ? `${primaryAddress.AddressLine1 ?? ''}, ${primaryAddress.City ?? ''}, ${primaryAddress.State ?? ''}`
      : 'N/A'

    console.log('🎉 Tenant sync completed successfully!')
    console.log('📊 Tenant details:')
    console.log(`   - Tenant ID: ${localTenantId}`)
    console.log(`   - Contact ID: ${contactId}`)
    console.log(`   - Buildium ID: ${buildiumTenant.Id}`)
    console.log(`   - Name: ${buildiumTenant.FirstName} ${buildiumTenant.LastName}`)
    console.log(`   - Email: ${buildiumTenant.Email}`)
    console.log(`   - Phone: ${displayPhone}`)
    console.log(`   - Address: ${addressString}`)
    console.log(`   - Lease Contact ID: ${leaseContactId}`)
    
    return localTenantId

  } catch (error) {
    console.error('❌ Failed to fetch and add tenant:', error)
    throw error
  }
}

// Get tenant ID from command line argument or use default
const tenantId = process.argv[2] ? parseInt(process.argv[2]) : 52147

if (!tenantId) {
  console.error('❌ Please provide a tenant ID as an argument')
  process.exit(1)
}

fetchAndAddBuildiumTenant(tenantId)
  .then(() => {
    console.log('🎯 Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })

export { fetchAndAddBuildiumTenant }
