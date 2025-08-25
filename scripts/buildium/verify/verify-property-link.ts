#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifyPropertyLink() {
  // Get property with bank account details
  const { data: property, error: propertyError } = await supabase
    .from('properties')
    .select(`
      *,
      bank_account:bank_accounts!operating_bank_account_id(*)
    `)
    .eq('buildium_property_id', 7647)
    .single()

  if (propertyError) {
    console.error('Error fetching property:', propertyError)
    return
  }

  console.log('\n📋 Property 7647 with Bank Account Link:')
  console.log('='.repeat(60))
  console.log(`Property Name: ${property.name}`)
  console.log(`Property ID: ${property.id}`)
  console.log(`Buildium Property ID: ${property.buildium_property_id}`)
  console.log(`Address: ${property.address_line1}, ${property.city}, ${property.state} ${property.postal_code}`)
  console.log(`Operating Bank Account ID: ${property.operating_bank_account_id}`)
  
  if (property.bank_account) {
    console.log('\n🏦 Linked Bank Account:')
    console.log(`  Name: ${property.bank_account.name}`)
    console.log(`  ID: ${property.bank_account.id}`)
    console.log(`  Buildium Bank ID: ${property.bank_account.buildium_bank_id}`)
    console.log(`  Type: ${property.bank_account.bank_account_type}`)
    console.log(`  Account Number: ${property.bank_account.account_number || 'N/A'}`)
    console.log(`  Routing Number: ${property.bank_account.routing_number || 'N/A'}`)
  } else {
    console.log('\n❌ No bank account linked')
  }
  
  console.log('\n✅ Property bank account link verification complete!\n')
}

verifyPropertyLink()
