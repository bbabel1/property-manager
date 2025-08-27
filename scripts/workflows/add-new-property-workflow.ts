#!/usr/bin/env tsx

/**
 * Add New Property Workflow Script
 * 
 * Purpose: Complete workflow for adding a new property with units, owners, leases, and tenants
 * Usage: npx tsx scripts/workflows/add-new-property-workflow.ts
 * 
 * This script demonstrates the complete workflow for adding a new property
 * and serves as a reference for the correct sequence of operations.
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface PropertyData {
  name: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country: string
  rental_sub_type: string
  operating_bank_account_id: number
  reserve?: number
  year_built?: number
}

interface UnitData {
  property_id: string
  unit_number: string
  bedrooms: number
  bathrooms: number
  square_footage?: number
  market_rent: number
  unit_type: string
}

interface OwnerData {
  first_name?: string
  last_name?: string
  company_name?: string
  email: string
  phone: string
  is_company: boolean
  tax_payer_id: string
  tax_payer_type: string
  tax_payer_name1: string
  tax_address_line1: string
  tax_city: string
  tax_state: string
  tax_postal_code: string
  tax_country: string
}

interface TenantData {
  first_name: string
  last_name: string
  email: string
  phone: string
  date_of_birth: string
  emergency_contact_name: string
  emergency_contact_phone: string
  emergency_contact_relationship: string
}

interface LeaseData {
  property_id: string
  unit_id: string
  start_date: string
  end_date: string
  monthly_rent: number
  security_deposit: number
  lease_status: string
  rent_cycle: string
}

async function addNewPropertyWorkflow() {
  console.log('🏠 Starting New Property Workflow...\n')
  
  try {
    // Step 1: Create Property
    console.log('📋 Step 1: Creating Property...')
    
    const propertyData: PropertyData = {
      name: "123 Main Street Apartments",
      address_line1: "123 Main Street",
      address_line2: "Suite 100",
      city: "Anytown",
      state: "CA",
      postal_code: "12345",
      country: "US",
      rental_sub_type: "MultiFamily",
      operating_bank_account_id: 123,
      reserve: 5000.00,
      year_built: 2020
    }
    
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .insert(propertyData)
      .select()
      .single()
    
    if (propertyError) {
      throw new Error(`Property creation failed: ${propertyError.message}`)
    }
    
    console.log(`✅ Property created: ${property.name} (ID: ${property.id})`)
    
    // Step 2: Add Units
    console.log('\n📋 Step 2: Adding Units...')
    
    const unitsData: UnitData[] = [
      {
        property_id: property.id,
        unit_number: "A1",
        bedrooms: 2,
        bathrooms: 1,
        square_footage: 850,
        market_rent: 1200.00,
        unit_type: "Apartment"
      },
      {
        property_id: property.id,
        unit_number: "A2",
        bedrooms: 1,
        bathrooms: 1,
        square_footage: 650,
        market_rent: 1000.00,
        unit_type: "Apartment"
      }
    ]
    
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .insert(unitsData)
      .select()
    
    if (unitsError) {
      throw new Error(`Units creation failed: ${unitsError.message}`)
    }
    
    console.log(`✅ Units created: ${units.length} units`)
    units.forEach(unit => {
      console.log(`   - Unit ${unit.unit_number}: ${unit.bedrooms}BR/${unit.bathrooms}BA`)
    })
    
    // Step 3: Create Owner
    console.log('\n📋 Step 3: Creating Owner...')
    
    const ownerData: OwnerData = {
      first_name: "John",
      last_name: "Doe",
      email: "john.doe@example.com",
      phone: "(555) 123-4567",
      is_company: false,
      tax_payer_id: "123-45-6789",
      tax_payer_type: "SSN",
      tax_payer_name1: "John Doe",
      tax_address_line1: "456 Owner Street",
      tax_city: "Owner City",
      tax_state: "CA",
      tax_postal_code: "54321",
      tax_country: "US"
    }
    
    const { data: owner, error: ownerError } = await supabase
      .from('owners')
      .insert(ownerData)
      .select()
      .single()
    
    if (ownerError) {
      throw new Error(`Owner creation failed: ${ownerError.message}`)
    }
    
    console.log(`✅ Owner created: ${owner.first_name} ${owner.last_name} (ID: ${owner.id})`)
    
    // Step 4: Create Ownership Relationship
    console.log('\n📋 Step 4: Creating Ownership Relationship...')
    
    const { data: ownership, error: ownershipError } = await supabase
      .from('ownership')
      .insert({
        owner_id: owner.id,
        property_id: property.id,
        ownership_percentage: 100.00,
        disbursement_percentage: 100.00,
        primary: true
      })
      .select()
      .single()
    
    if (ownershipError) {
      throw new Error(`Ownership creation failed: ${ownershipError.message}`)
    }
    
    console.log(`✅ Ownership relationship created: ${ownership.ownership_percentage}% ownership`)
    
    // Step 5: Create Tenant
    console.log('\n📋 Step 5: Creating Tenant...')
    
    const tenantData: TenantData = {
      first_name: "Jane",
      last_name: "Smith",
      email: "jane.smith@example.com",
      phone: "(555) 111-2222",
      date_of_birth: "1990-01-15",
      emergency_contact_name: "Bob Smith",
      emergency_contact_phone: "(555) 333-4444",
      emergency_contact_relationship: "Spouse"
    }
    
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert(tenantData)
      .select()
      .single()
    
    if (tenantError) {
      throw new Error(`Tenant creation failed: ${tenantError.message}`)
    }
    
    console.log(`✅ Tenant created: ${tenant.first_name} ${tenant.last_name} (ID: ${tenant.id})`)
    
    // Step 6: Create Lease
    console.log('\n📋 Step 6: Creating Lease...')
    
    const leaseData: LeaseData = {
      property_id: property.id,
      unit_id: units[0].id, // Use first unit
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      monthly_rent: 1200.00,
      security_deposit: 1200.00,
      lease_status: "Active",
      rent_cycle: "Monthly"
    }
    
    const { data: lease, error: leaseError } = await supabase
      .from('lease')
      .insert(leaseData)
      .select()
      .single()
    
    if (leaseError) {
      throw new Error(`Lease creation failed: ${leaseError.message}`)
    }
    
    console.log(`✅ Lease created: ${lease.monthly_rent}/month (ID: ${lease.id})`)
    
    // Step 7: Link Tenant to Lease
    console.log('\n📋 Step 7: Linking Tenant to Lease...')
    
    const { data: leaseContact, error: leaseContactError } = await supabase
      .from('lease_contacts')
      .insert({
        lease_id: lease.id,
        tenant_id: tenant.id,
        role: "Tenant",
        is_primary: true,
        move_in_date: "2025-01-01"
      })
      .select()
      .single()
    
    if (leaseContactError) {
      throw new Error(`Lease contact creation failed: ${leaseContactError.message}`)
    }
    
    console.log(`✅ Tenant linked to lease as primary tenant`)
    
    // Step 8: Create Rent Schedule
    console.log('\n📋 Step 8: Creating Rent Schedule...')
    
    const { data: rentSchedule, error: rentScheduleError } = await supabase
      .from('rent_schedules')
      .insert({
        lease_id: lease.id,
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        total_amount: 1200.00,
        rent_cycle: "Monthly",
        backdate_charges: false
      })
      .select()
      .single()
    
    if (rentScheduleError) {
      throw new Error(`Rent schedule creation failed: ${rentScheduleError.message}`)
    }
    
    console.log(`✅ Rent schedule created: ${rentSchedule.total_amount}/month`)
    
    // Summary
    console.log('\n🎯 Workflow Summary:')
    console.log(`   Property: ${property.name}`)
    console.log(`   Units: ${units.length}`)
    console.log(`   Owner: ${owner.first_name} ${owner.last_name}`)
    console.log(`   Tenant: ${tenant.first_name} ${tenant.last_name}`)
    console.log(`   Lease: ${lease.monthly_rent}/month`)
    console.log(`   Rent Schedule: ${rentSchedule.total_amount}/month`)
    
    console.log('\n✅ New Property Workflow completed successfully!')
    console.log('   All entities have been created and linked properly.')
    
  } catch (error) {
    console.error('❌ Workflow failed:', error)
    process.exit(1)
  }
}

// Run workflow if called directly
if (require.main === module) {
  addNewPropertyWorkflow()
}

export { addNewPropertyWorkflow }
