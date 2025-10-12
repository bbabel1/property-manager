#!/usr/bin/env tsx

// MUST load environment variables BEFORE any other imports
import { config } from 'dotenv'
config({ path: '.env.local' })

// Now import everything else after env is loaded
import { createClient } from '@supabase/supabase-js'

const billId = 723093

// Create Supabase admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fetchBillFromBuildium(billId: number) {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bills/${billId}`
  
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
    console.log('Bill data from Buildium:', JSON.stringify(data, null, 2))
    console.log(`Successfully fetched bill ${billId} from Buildium`)
    return data
  } catch (error) {
    console.error('Error fetching bill from Buildium')
    console.error('Error details:', error)
    throw error
  }
}

async function insertBillIntoDatabase(buildiumBill: any) {
  try {
    // Check if bill already exists in database
    const { data: existingBill } = await supabaseAdmin
      .from('bills')
      .select('id, buildium_bill_id')
      .eq('buildium_bill_id', buildiumBill.Id)
      .single()

    if (existingBill) {
      console.log(`Bill ${buildiumBill.Id} already exists in database with ID: ${existingBill.id}`)
      return existingBill
    }

    // Prepare bill data for database insertion
    const billData = {
      buildium_bill_id: buildiumBill.Id,
      vendor_id: buildiumBill.VendorId ? await getVendorId(buildiumBill.VendorId) : null,
      property_id: buildiumBill.PropertyId ? await getPropertyId(buildiumBill.PropertyId) : null,
      unit_id: buildiumBill.UnitId ? await getUnitId(buildiumBill.UnitId) : null,
      date: buildiumBill.Date,
      due_date: buildiumBill.DueDate,
      amount: buildiumBill.Amount,
      description: buildiumBill.Description,
      reference_number: buildiumBill.ReferenceNumber,
      category_id: buildiumBill.CategoryId,
      is_recurring: buildiumBill.IsRecurring || false,
      recurring_schedule: buildiumBill.RecurringSchedule ? JSON.stringify(buildiumBill.RecurringSchedule) : null,
      status: mapBillStatus(buildiumBill.Status)
    }

    console.log(`Inserting bill into database...`)

    // Insert the bill into the database
    const { data: insertedBill, error: insertError } = await supabaseAdmin
      .from('bills')
      .insert(billData)
      .select()
      .single()

    if (insertError) {
      console.error(`Error inserting bill into database: ${insertError.message}`)
      throw new Error(`Failed to insert bill: ${insertError.message}`)
    }

    console.log(`Successfully inserted bill into database with ID: ${insertedBill.id}`)
    return insertedBill

  } catch (error) {
    console.error(`Error inserting bill into database: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}

// Helper function to get vendor ID from Buildium vendor ID
async function getVendorId(buildiumVendorId: number): Promise<string | null> {
  try {
    const { data: vendor } = await supabaseAdmin
      .from('vendors')
      .select('id')
      .eq('buildium_vendor_id', buildiumVendorId)
      .single()

    return vendor?.id || null
  } catch (error) {
    console.warn(`Vendor with Buildium ID ${buildiumVendorId} not found in database`)
    return null
  }
}

// Helper function to get property ID from Buildium property ID
async function getPropertyId(buildiumPropertyId: number): Promise<string | null> {
  try {
    const { data: property } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('buildium_property_id', buildiumPropertyId)
      .single()

    return property?.id || null
  } catch (error) {
    console.warn(`Property with Buildium ID ${buildiumPropertyId} not found in database`)
    return null
  }
}

// Helper function to get unit ID from Buildium unit ID
async function getUnitId(buildiumUnitId: number): Promise<string | null> {
  try {
    const { data: unit } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('buildium_unit_id', buildiumUnitId)
      .single()

    return unit?.id || null
  } catch (error) {
    console.warn(`Unit with Buildium ID ${buildiumUnitId} not found in database`)
    return null
  }
}

// Helper function to map Buildium bill status to database status
function mapBillStatus(buildiumStatus: string): string {
  const statusMap: Record<string, string> = {
    'Pending': 'pending',
    'Paid': 'paid',
    'Overdue': 'overdue',
    'Cancelled': 'cancelled',
    'Draft': 'draft'
  }

  return statusMap[buildiumStatus] || 'pending'
}

async function main() {
  try {
    console.log(`Fetching bill ${billId} from Buildium...`)
    const buildiumBill = await fetchBillFromBuildium(billId)
    
    console.log('\nKey bill fields:')
    console.log('ID:', buildiumBill.Id)
    console.log('Vendor ID:', buildiumBill.VendorId)
    console.log('Property ID:', buildiumBill.PropertyId)
    console.log('Unit ID:', buildiumBill.UnitId)
    console.log('Date:', buildiumBill.Date)
    console.log('Due Date:', buildiumBill.DueDate)
    console.log('Amount:', buildiumBill.Amount)
    console.log('Description:', buildiumBill.Description)
    console.log('Status:', buildiumBill.Status)
    console.log('Reference Number:', buildiumBill.ReferenceNumber)
    console.log('Category ID:', buildiumBill.CategoryId)
    console.log('Is Recurring:', buildiumBill.IsRecurring)
    
    // Insert the bill into the database
    const insertedBill = await insertBillIntoDatabase(buildiumBill)
    
    console.log('\nBill successfully processed:')
    console.log('Database ID:', insertedBill.id)
    console.log('Buildium ID:', insertedBill.buildium_bill_id)
    console.log('Amount:', insertedBill.amount)
    console.log('Status:', insertedBill.status)
    
  } catch (error) {
    console.error('Failed to fetch and insert bill')
    console.error('Error details:', error)
    process.exit(1)
  }
}

main()
