#!/usr/bin/env tsx

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  resolveGLAccountId,
  mapPaymentMethodToEnum
} from '../../src/lib/buildium-mappers'

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

async function resolveLocalPropertyId(buildiumPropertyId: number | null | undefined) {
  if (!buildiumPropertyId) return null
  try {
    const { data, error } = await supabaseAdmin
      .from('properties')
      .select('id')
      .eq('buildium_property_id', buildiumPropertyId)
      .maybeSingle()

    if (error) {
      logger.warn(`Failed to resolve local property for Buildium property ${buildiumPropertyId}: ${error.message}`)
      return null
    }
    return data?.id ?? null
  } catch (error: any) {
    logger.warn(`Error resolving local property ${buildiumPropertyId}: ${error?.message ?? error}`)
    return null
  }
}

async function resolveLocalUnitId(buildiumUnitId: number | null | undefined) {
  if (!buildiumUnitId) return null
  try {
    const { data, error } = await supabaseAdmin
      .from('units')
      .select('id')
      .eq('buildium_unit_id', buildiumUnitId)
      .maybeSingle()

    if (error) {
      logger.warn(`Failed to resolve local unit for Buildium unit ${buildiumUnitId}: ${error.message}`)
      return null
    }
    return data?.id ?? null
  } catch (error: any) {
    logger.warn(`Error resolving local unit ${buildiumUnitId}: ${error?.message ?? error}`)
    return null
  }
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
    const paymentLines = Array.isArray(buildiumPayment?.Lines) ? buildiumPayment.Lines : []
    const paymentTotalRaw = paymentLines.reduce((sum: number, line: any) => sum + Number(line?.Amount ?? 0), 0)
    const paymentTotalAbs = Math.abs(paymentTotalRaw)
    const totalAmount = paymentTotalRaw === 0 ? 0 : paymentTotalRaw > 0 ? -paymentTotalAbs : paymentTotalRaw
    const entryDateIso = buildiumPayment.EntryDate ? new Date(buildiumPayment.EntryDate).toISOString() : new Date().toISOString()
    const entryDate = entryDateIso.split('T')[0]
    const nowIso = new Date().toISOString()

    // Derive property/unit context from the first distribution line (if present)
    const firstLine = paymentLines[0] || {}
    const buildiumPropertyId = firstLine?.AccountingEntity?.Id ?? null
    const buildiumUnitId = firstLine?.AccountingEntity?.Unit?.Id
      ?? firstLine?.AccountingEntity?.UnitId
      ?? null
    const localPropertyId = await resolveLocalPropertyId(buildiumPropertyId)
    const localUnitId = await resolveLocalUnitId(buildiumUnitId)
    const accountEntityTypeRaw = (firstLine?.AccountingEntity?.AccountingEntityType || 'Rental') as string
    const accountEntityType = accountEntityTypeRaw.toLowerCase() === 'company' ? 'Company' : 'Rental'

    const accountsPayableGlId = await resolveGLAccountId(7, supabaseAdmin)
    const { data: bankAccount } = await supabaseAdmin
      .from('bank_accounts')
      .select('id, gl_account, property_id, buildium_bank_id')
      .eq('buildium_bank_id', buildiumPayment.BankAccountId != null ? String(buildiumPayment.BankAccountId) : '')
      .maybeSingle()

    let bankGlAccountId: string | null = null
    if (bankAccount?.gl_account) {
      const { data: bankGl } = await supabaseAdmin
        .from('gl_accounts')
        .select('id, is_bank_account')
        .eq('id', bankAccount.gl_account)
        .maybeSingle()
      if (bankGl?.is_bank_account) {
        bankGlAccountId = bankGl.id
      }
    }
    if (!bankGlAccountId && buildiumPayment.BankAccountId) {
      bankGlAccountId = await resolveGLAccountId(buildiumPayment.BankAccountId, supabaseAdmin)
    }

    // Pull lease context from the originating bill
    const { data: billData } = await supabaseAdmin
      .from('transactions')
      .select('lease_id')
      .eq('buildium_bill_id', billId)
      .eq('transaction_type', 'Bill')
      .maybeSingle()
    const leaseId = billData?.lease_id ?? null

    const paymentHeader = {
      buildium_transaction_id: buildiumPayment.Id,
      date: entryDate,
      transaction_type: 'Payment' as const,
      total_amount: totalAmount,
      check_number: buildiumPayment.CheckNumber || '',
      lease_id: leaseId,
      payee_tenant_id: buildiumPayment.PayeeTenantId ?? null,
      payment_method: mapPaymentMethodToEnum(buildiumPayment.PaymentMethod),
      memo: buildiumPayment.Memo ?? null,
      buildium_bill_id: billId,
      bank_account_id: bankAccount?.id ?? null,
      updated_at: nowIso
    }

    // Upsert header
    const { data: existingPayment } = await supabaseAdmin
      .from('transactions')
      .select('id, created_at')
      .eq('buildium_transaction_id', buildiumPayment.Id)
      .eq('transaction_type', 'Payment')
      .maybeSingle()

    let transactionId: string
    if (existingPayment) {
      const { error: updateError } = await supabaseAdmin
        .from('transactions')
        .update(paymentHeader)
        .eq('id', existingPayment.id)
      if (updateError) {
        logger.error('Failed to update existing payment header', updateError)
        throw updateError
      }
      transactionId = existingPayment.id
    } else {
      const { data: insertedPayment, error: insertError } = await supabaseAdmin
        .from('transactions')
        .insert({ ...paymentHeader, created_at: nowIso })
        .select('*')
        .single()
      if (insertError) {
        logger.error('Error inserting bill payment into database:', insertError)
        throw insertError
      }
      logger.info(`Successfully inserted bill payment into transactions table with ID: ${insertedPayment.id}`)
      transactionId = insertedPayment.id
    }

    // Refresh ledger lines
    await supabaseAdmin
      .from('transaction_lines')
      .delete()
      .eq('transaction_id', transactionId)

    const propertyIdForLines = localPropertyId ?? bankAccount?.property_id ?? null
    const lineTimestamp = nowIso
    const lineDate = entryDate
    const memo = buildiumPayment.Memo ?? null
    const ledgerLines: any[] = []

    if (accountsPayableGlId && paymentTotalAbs > 0) {
      ledgerLines.push({
        transaction_id: transactionId,
        gl_account_id: accountsPayableGlId,
        amount: paymentTotalAbs,
        posting_type: 'Debit',
        memo,
        account_entity_type: accountEntityType,
        account_entity_id: buildiumPropertyId ?? null,
        date: lineDate,
        created_at: lineTimestamp,
        updated_at: lineTimestamp,
        buildium_property_id: buildiumPropertyId,
        buildium_unit_id: buildiumUnitId,
        buildium_lease_id: null,
        property_id: propertyIdForLines,
        unit_id: localUnitId
      })
    } else {
      if (!accountsPayableGlId) {
        logger.warn('Unable to resolve Accounts Payable GL account; payment ledger will be incomplete')
      }
    }

    if (bankGlAccountId && paymentTotalAbs > 0) {
      ledgerLines.push({
        transaction_id: transactionId,
        gl_account_id: bankGlAccountId,
        amount: paymentTotalAbs,
        posting_type: 'Credit',
        memo,
        account_entity_type: accountEntityType,
        account_entity_id: buildiumPropertyId ?? null,
        date: lineDate,
        created_at: lineTimestamp,
        updated_at: lineTimestamp,
        buildium_property_id: buildiumPropertyId,
        buildium_unit_id: buildiumUnitId,
        buildium_lease_id: null,
        property_id: propertyIdForLines,
        unit_id: localUnitId
      })
    } else {
      if (!bankGlAccountId) {
        logger.warn(`Unable to resolve bank GL account for Buildium bank ${buildiumPayment.BankAccountId}; cash balance will be off`)
      }
    }

    if (ledgerLines.length > 0) {
      const { error: lineInsertError } = await supabaseAdmin
        .from('transaction_lines')
        .insert(ledgerLines)
      if (lineInsertError) {
        logger.error('Failed to insert payment ledger lines', lineInsertError)
        throw lineInsertError
      }
    }

    const { data: refreshed } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()

    return refreshed
  } catch (error) {
    logger.error('Error in insertBillPaymentIntoDatabase:', error)
    throw error
  }
}

// Note: GL account resolution is handled by resolveGLAccountId()

async function main() {
  const billId = Number(process.argv[2])
  const paymentId = Number(process.argv[3])

  if (!Number.isFinite(billId) || !Number.isFinite(paymentId)) {
    console.error('Usage: tsx scripts/buildium/fetch-and-insert-bill-payment.ts <billId> <paymentId>')
    process.exit(1)
  }

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
