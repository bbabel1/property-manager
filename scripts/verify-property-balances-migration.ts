import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function verifyMigration() {
  console.log('🔍 Verifying property balances migration...\n')

  // 1. Check if new columns exist
  console.log('1. Checking for new columns on properties table...')
  const { data: columns, error: colError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'properties' 
        AND column_name IN ('cash_balance', 'security_deposits', 'available_balance', 'cash_updated_at')
      ORDER BY column_name
    `
  })
  
  if (colError) {
    console.error('   ❌ Error checking columns:', colError.message)
  } else {
    console.log('   ✅ Columns found:', columns?.length || 0)
  }

  // 2. Check if functions exist
  console.log('\n2. Checking for recalculation function...')
  const { data: funcs, error: funcError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('fn_recalculate_property_financials', 'get_property_financials')
      ORDER BY routine_name
    `
  })
  
  if (funcError) {
    console.error('   ❌ Error checking functions:', funcError.message)
  } else {
    console.log('   ✅ Functions found:', funcs?.length || 0)
  }

  // 3. Check if triggers exist
  console.log('\n3. Checking for triggers...')
  const { data: triggers, error: trigError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table = 'transaction_lines' 
        AND trigger_name LIKE 'trg_properties_recalc%'
      ORDER BY trigger_name
    `
  })
  
  if (trigError) {
    console.error('   ❌ Error checking triggers:', trigError.message)
  } else {
    console.log('   ✅ Triggers found:', triggers?.length || 0)
  }

  // 4. Check if data was backfilled (sample a few properties)
  console.log('\n4. Checking if property data was backfilled...')
  const { data: props, error: propsError } = await supabase
    .from('properties')
    .select('id, name, cash_balance, security_deposits, available_balance, cash_updated_at')
    .not('cash_balance', 'is', null)
    .limit(5)
  
  if (propsError) {
    console.error('   ❌ Error checking properties:', propsError.message)
  } else {
    console.log(`   ✅ Found ${props?.length || 0} properties with backfilled data`)
    if (props && props.length > 0) {
      console.log('\n   Sample property:')
      const sample = props[0]
      console.log(`   - Name: ${sample.name}`)
      console.log(`   - Cash Balance: $${sample.cash_balance}`)
      console.log(`   - Security Deposits: $${sample.security_deposits}`)
      console.log(`   - Available Balance: $${sample.available_balance}`)
      console.log(`   - Updated At: ${sample.cash_updated_at}`)
    }
  }

  console.log('\n✨ Verification complete!')
}

verifyMigration().catch(console.error)


