import { createClient } from '@supabase/supabase-js'
import { mapLeaseFromBuildium } from '@/lib/buildium-mappers'
import * as dotenv from 'dotenv'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

// Load environment variables
dotenv.config({ path: '.env.local' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function fetchBuildiumLease(leaseId: number) {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/leases/${leaseId}`
  
  const response = await fetch(buildiumUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      'x-buildium-egress-allowed': '1',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch lease from Buildium: ${response.status} ${response.statusText}`)
  }

  return await response.json()
}

async function getPropertyByBuildiumId(buildiumPropertyId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('buildium_property_id', buildiumPropertyId)
    .single()

  if (error) {
    console.error('Error finding property:', error)
    return null
  }

  return data?.id || null
}

async function getUnitByBuildiumId(buildiumUnitId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from('units')
    .select('id')
    .eq('buildium_unit_id', buildiumUnitId)
    .single()

  if (error) {
    console.error('Error finding unit:', error)
    return null
  }

  return data?.id || null
}

async function fetchAndAddBuildiumLease(leaseId: number) {
  try {
    await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
    console.log(`🔍 Fetching Buildium lease ${leaseId}...`)
    
    const buildiumLease = await fetchBuildiumLease(leaseId)
    console.log('✅ Successfully fetched lease from Buildium:', buildiumLease.Id)

    // Check if lease already exists
    const { data: existingLeases, error: checkError } = await supabase
      .from('lease')
      .select('*')
      .eq('buildium_lease_id', leaseId)

    if (checkError) {
      console.error('❌ Error checking existing lease:', checkError)
      throw checkError
    }

    if (existingLeases && existingLeases.length > 0) {
      console.log('⚠️ Lease already exists in database:', existingLeases[0].id)
      return existingLeases[0].id
    }

    // Resolve property and unit IDs
    const localPropertyId = await getPropertyByBuildiumId(buildiumLease.PropertyId)
    if (!localPropertyId) {
      throw new Error(`Property with Buildium ID ${buildiumLease.PropertyId} not found in local database. Please sync the property first.`)
    }

    const localUnitId = await getUnitByBuildiumId(buildiumLease.UnitId)
    if (!localUnitId) {
      throw new Error(`Unit with Buildium ID ${buildiumLease.UnitId} not found in local database. Please sync the unit first.`)
    }

    console.log('🔄 Mapping lease with updated mapper...')
    const mappedData = mapLeaseFromBuildium(buildiumLease)
    
    // Add required database fields
    const leaseData = {
      propertyId: localPropertyId,
      unitId: localUnitId,
      ...mappedData,
      comment: null, // Required field with default
      updated_at: new Date().toISOString()
    }

    console.log('📋 Mapped lease data:', leaseData)

    // Insert new lease
    const { data: newLease, error: insertError } = await supabase
      .from('lease')
      .insert(leaseData)
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error inserting lease:', insertError)
      throw insertError
    }

    console.log('✅ Successfully added new lease to database:', newLease.id)
    console.log('🎉 Lease sync completed successfully!')
    console.log('📊 Lease details:')
    console.log(`   - Local ID: ${newLease.id}`)
    console.log(`   - Buildium ID: ${buildiumLease.Id}`)
    console.log(`   - Property ID: ${localPropertyId}`)
    console.log(`   - Unit ID: ${localUnitId}`)
    console.log(`   - Status: ${newLease.status}`)
    console.log(`   - Rent Amount: $${newLease.rent_amount}`)
    console.log(`   - Security Deposit: $${newLease.security_deposit}`)
    
    return newLease.id

  } catch (error) {
    console.error('❌ Failed to fetch and add lease:', error)
    throw error
  }
}

// Get lease ID from command line argument or use default
const leaseId = process.argv[2] ? parseInt(process.argv[2]) : 16235

if (!leaseId) {
  console.error('❌ Please provide a lease ID as an argument')
  process.exit(1)
}

fetchAndAddBuildiumLease(leaseId)
  .then(() => {
    console.log('🎯 Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })

export { fetchAndAddBuildiumLease }
