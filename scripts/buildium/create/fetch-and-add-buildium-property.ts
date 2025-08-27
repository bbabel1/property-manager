import { createClient } from '@supabase/supabase-js'
import { mapPropertyFromBuildium } from '@/lib/buildium-mappers'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env' })

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Helper function to get bank account ID by Buildium bank ID
async function getBankAccountByBuildiumId(buildiumBankId: number): Promise<string | null> {
  try {
    const { data: bankAccount, error } = await supabase
      .from('bank_accounts')
      .select('id')
      .eq('buildium_bank_id', buildiumBankId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        console.log(`⚠️  Bank account with Buildium ID ${buildiumBankId} not found in local database`)
        return null
      }
      throw new Error(`Failed to get bank account: ${error.message}`)
    }

    console.log(`✅ Found bank account with Buildium ID ${buildiumBankId}: ${bankAccount.id}`)
    return bankAccount.id
  } catch (error) {
    console.error(`❌ Error looking up bank account with Buildium ID ${buildiumBankId}:`, error)
    return null
  }
}

async function fetchBuildiumProperty(propertyId: number) {
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/${propertyId}`
  
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
    console.log('Property data from Buildium:', JSON.stringify(data, null, 2))
    return data
  } catch (error) {
    console.error('Error fetching property from Buildium:', error)
    throw error
  }
}

async function fetchAndAddBuildiumProperty(propertyId: number) {
  try {
    console.log(`🔍 Fetching Buildium property ${propertyId}...`)

    // Fetch property from Buildium
    const buildiumProperty = await fetchBuildiumProperty(propertyId)
    console.log('✅ Successfully fetched property from Buildium:', buildiumProperty.Name)

    // Look up the operating bank account ID
    let operatingBankAccountId: string | null = null
    if (buildiumProperty.OperatingBankAccountId) {
      console.log(`🏦 Looking up operating bank account with Buildium ID: ${buildiumProperty.OperatingBankAccountId}`)
      operatingBankAccountId = await getBankAccountByBuildiumId(buildiumProperty.OperatingBankAccountId)
      
      if (!operatingBankAccountId) {
        console.log(`⚠️  Warning: Operating bank account with Buildium ID ${buildiumProperty.OperatingBankAccountId} not found. Property will be created without bank account reference.`)
      }
    }

    // Check if property already exists in database
    const { data: existingProperties, error: checkError } = await supabase
      .from('properties')
      .select('*')
      .eq('buildium_property_id', propertyId)

    if (checkError) {
      console.error('❌ Error checking existing property:', checkError)
      throw checkError
    }

    // Map Buildium data to our database format
    const localData = mapPropertyFromBuildium(buildiumProperty)
    
    // Add the operating bank account ID if found
    if (operatingBankAccountId) {
      localData.operating_bank_account_id = operatingBankAccountId
    }
    
    // Add required timestamp fields
    const now = new Date().toISOString()
    const finalData = {
      ...localData,
      created_at: now,
      updated_at: now
    }

    console.log('📋 Mapped property data:', finalData)

    let property
    let error

    if (existingProperties && existingProperties.length > 0) {
      // Update existing property
      console.log(`🔄 Found existing property, updating...`)
      const { data: updatedProperty, error: updateError } = await supabase
        .from('properties')
        .update(finalData)
        .eq('id', existingProperties[0].id)
        .select()
        .single()
      
      property = updatedProperty
      error = updateError
      
      if (error) {
        console.error('❌ Error updating property:', error)
        throw error
      }
      
      console.log('✅ Successfully updated existing property in database:', property.id)
    } else {
      // Insert new property
      console.log(`➕ Creating new property in database...`)
      const { data: newProperty, error: insertError } = await supabase
        .from('properties')
        .insert(finalData)
        .select()
        .single()
      
      property = newProperty
      error = insertError
      
      if (error) {
        console.error('❌ Error inserting property:', error)
        throw error
      }
      
      console.log('✅ Successfully added new property to database:', property.id)
    }

    console.log('🎉 Property sync completed successfully!')
    console.log('📊 Property details:')
    console.log(`   - Local ID: ${property.id}`)
    console.log(`   - Buildium ID: ${property.buildium_property_id}`)
    console.log(`   - Name: ${property.name}`)
    console.log(`   - Address: ${property.address_line1}, ${property.city}, ${property.state}`)
    console.log(`   - Status: ${property.is_active ? 'Active' : 'Inactive'}`)
    console.log(`   - Operating Bank Account ID: ${property.operating_bank_account_id || 'Not set'}`)

    return property

  } catch (error) {
    console.error('❌ Failed to fetch and add property:', error)
    throw error
  }
}

// Run the script
if (require.main === module) {
  const args = process.argv.slice(2)
  const propertyId = args[0] ? parseInt(args[0]) : undefined
  
  if (!propertyId || isNaN(propertyId)) {
    console.error('❌ Invalid property ID. Please provide a valid number.')
    console.log('Usage: npm run script scripts/buildium/create/fetch-and-add-buildium-property.ts <propertyId>')
    process.exit(1)
  }
  
  fetchAndAddBuildiumProperty(propertyId)
    .then(() => {
      console.log('🎯 Script completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Script failed:', error)
      process.exit(1)
    })
}

export { fetchAndAddBuildiumProperty }
