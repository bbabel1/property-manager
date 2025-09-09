#!/usr/bin/env tsx

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { resolveGLAccountId, mapPaymentMethodToEnum } from '../../src/lib/buildium-mappers'

// Load environment variables first
config()

// Create Supabase admin client for database operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Logger function
const logger = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  error: (message: string, error?: any) => console.error(`[ERROR] ${message}`, error),
  warn: (message: string) => console.warn(`[WARN] ${message}`)
}

async function fetchBillPaymentFromBuildium(billId: number, paymentId: number) {
  // Use direct Buildium API call with correct authentication
  const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/bills/${billId}/payments/${paymentId}`
  
  logger.info(`Fetching bill payment ${paymentId} for bill ${billId} from Buildium...`)
  
  const response = await fetch(buildiumUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error(`Buildium API error: ${response.status} ${response.statusText}`)
    throw new Error(`Buildium API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  console.log('Bill payment data from Buildium:', JSON.stringify(data, null, 2))
  logger.info(`Successfully fetched bill payment ${paymentId} from Buildium`)
  return data
}

async function insertBillPaymentIntoDatabase(buildiumPayment: any, billId: number) {
  try {
    // Check if payment already exists
    const { data: existingPayment } = await supabaseAdmin
      .from('transactions')
      .select('id, buildium_transaction_id')
      .eq('buildium_transaction_id', buildiumPayment.Id)
      .eq('transaction_type', 'Payment')
      .single()

    if (existingPayment) {
      logger.info(`Bill payment ${buildiumPayment.Id} already exists in database with ID: ${existingPayment.id}`)
      
      // Check if transaction lines already exist
      const { data: existingLines } = await supabaseAdmin
        .from('transaction_lines')
        .select('id')
        .eq('transaction_id', existingPayment.id)

      if (existingLines && existingLines.length > 0) {
        logger.info(`Transaction lines already exist for payment ${buildiumPayment.Id}`)
        return existingPayment
      }
      
      // Insert payment lines into transaction_lines table
      if (buildiumPayment.Lines && buildiumPayment.Lines.length > 0) {
        for (const line of buildiumPayment.Lines) {
          await insertPaymentLine(existingPayment.id, line, billId)
        }
      }
      
      return existingPayment
    }

    // Get lease_id from the bill's lease_id
    const { data: billData } = await supabaseAdmin
      .from('transactions')
      .select('lease_id')
      .eq('buildium_bill_id', billId)
      .eq('transaction_type', 'Bill')
      .single()

    const leaseId = billData?.lease_id || 1 // Default to 1 if not found

    // Calculate total amount from lines
    const totalAmount = buildiumPayment.Lines?.reduce((sum: number, line: any) => sum + (line.Amount || 0), 0) || 0

    // Insert the payment as a transaction
    const { data: insertedPayment, error: insertError } = await supabaseAdmin
      .from('transactions')
      .insert({
        buildium_transaction_id: buildiumPayment.Id,
        date: buildiumPayment.EntryDate,
        transaction_type: 'Payment',
        total_amount: totalAmount,
        check_number: buildiumPayment.CheckNumber || '',
        lease_id: leaseId,
        payee_tenant_id: buildiumPayment.PayeeTenantId,
        payment_method: mapPaymentMethodToEnum(buildiumPayment.PaymentMethod),
        memo: buildiumPayment.Memo,
        buildium_bill_id: billId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (insertError) {
      logger.error('Error inserting bill payment into database:', insertError)
      throw insertError
    }

    logger.info(`Successfully inserted bill payment into transactions table with ID: ${insertedPayment.id}`)

    // Insert payment lines into transaction_lines table
    if (buildiumPayment.Lines && buildiumPayment.Lines.length > 0) {
      for (const line of buildiumPayment.Lines) {
        await insertPaymentLine(insertedPayment.id, line, billId)
      }
    }

    return insertedPayment
  } catch (error) {
    logger.error('Error in insertBillPaymentIntoDatabase:', error)
    throw error
  }
}

async function insertPaymentLine(transactionId: string, line: any, billId: number) {
  try {
    // Resolve or create local GL account from Buildium GL account ID
    const glAccountId = await resolveGLAccountId(line.GLAccountId, supabaseAdmin)

    // Get property and unit info from the accounting entity
    const propertyId = line.AccountingEntity?.Id || null
    const unitId = line.AccountingEntity?.UnitId || null

    const { data: insertedLine, error: insertError } = await supabaseAdmin
      .from('transaction_lines')
      .insert({
        transaction_id: transactionId,
        gl_account_id: glAccountId,
        amount: line.Amount,
        memo: line.Memo || null,
        date: new Date().toISOString().split('T')[0], // Use current date
        account_entity_type: line.AccountingEntity?.AccountingEntityType || 'Rental',
        buildium_property_id: propertyId,
        buildium_unit_id: unitId,
        posting_type: 'Credit', // Payment lines are typically credits
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (insertError) {
      logger.error('Error inserting payment line:', insertError)
      throw insertError
    }

    logger.info(`Successfully inserted payment line with ID: ${insertedLine.id}`)
    return insertedLine
  } catch (error) {
    logger.error('Error in insertPaymentLine:', error)
    throw error
  }
}

// Note: GL account resolution is handled by resolveGLAccountId()

async function main() {
  const billId = 723092
  const paymentId = 844376

  try {
    logger.info(`Starting bill payment fetch and insert process...`)
    logger.info(`Bill ID: ${billId}`)
    logger.info(`Payment ID: ${paymentId}`)

    // Step 1: Fetch bill payment from Buildium
    const buildiumPayment = await fetchBillPaymentFromBuildium(billId, paymentId)

    // Step 2: Insert into database
    const insertedPayment = await insertBillPaymentIntoDatabase(buildiumPayment, billId)

    // Step 3: Display results
    console.log('\n🎉 Success! Bill payment has been fetched and inserted:')
    console.log('Transaction ID:', insertedPayment.id)
    console.log('Buildium Payment ID:', insertedPayment.buildium_transaction_id)
    console.log('Bill ID:', insertedPayment.buildium_bill_id)
    console.log('Date:', insertedPayment.date)
    console.log('Amount:', insertedPayment.total_amount)
    console.log('Payment Method:', insertedPayment.payment_method)
    console.log('Memo:', insertedPayment.memo)

    logger.info('Bill payment fetch and insert process completed successfully!')

  } catch (error) {
    logger.error('Error in main process:', error)
    process.exit(1)
  }
}

// Run the script
main()
