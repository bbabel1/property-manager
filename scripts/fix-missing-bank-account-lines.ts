#!/usr/bin/env npx tsx
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Backfill script to add missing bank account debit lines to Payment transactions
 * that only have credit lines (AR/Revenue allocations) but are missing the bank account debit.
 */

// Load environment variables BEFORE any imports
import { config } from 'dotenv';
config({ path: '.env.local' });

async function fixMissingBankAccountLines() {
  // Dynamic import to ensure env vars are loaded first
  const { supabaseAdmin } = await import('../src/lib/db.js');
  console.log('Finding Payment transactions missing bank account lines...\n');

  // Find all Payment transactions
  const { data: paymentTransactions, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('id, lease_id, property_id, total_amount, date, transaction_type, buildium_transaction_id, buildium_lease_id')
    .eq('transaction_type', 'Payment')
    .order('date', { ascending: false });

  if (txError) {
    console.error('Error fetching transactions:', txError);
    process.exit(1);
  }

  console.log(`Found ${paymentTransactions?.length ?? 0} Payment/ApplyDeposit transactions\n`);

  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const tx of paymentTransactions ?? []) {
    // Get all transaction lines for this transaction
    const { data: lines, error: linesError } = await supabaseAdmin
      .from('transaction_lines')
      .select('id, gl_account_id, amount, posting_type, gl_accounts(is_bank_account)')
      .eq('transaction_id', tx.id);

    if (linesError) {
      console.error(`Error fetching lines for transaction ${tx.id}:`, linesError);
      errorCount++;
      continue;
    }

    // Check if there's already a bank account line
    const hasBankAccountLine = (lines ?? []).some((line) =>
      Boolean((line.gl_accounts as any)?.is_bank_account),
    );

    if (hasBankAccountLine) {
      skippedCount++;
      continue;
    }

    // Calculate credit sum (allocations to AR/Revenue)
    const creditSum = (lines ?? [])
      .filter((line) => line.posting_type === 'Credit')
      .reduce((sum, line) => sum + Number(line.amount ?? 0), 0);

    if (creditSum <= 0) {
      skippedCount++;
      continue;
    }

    // Resolve property ID from lease
    let propertyId = null;
    if ((tx as any).lease_id) {
      const { data: lease } = await supabaseAdmin
        .from('lease')
        .select('property_id')
        .eq('id', (tx as any).lease_id)
        .maybeSingle();
      propertyId = (lease as any)?.property_id ?? null;
    }

    if (!propertyId) {
      console.warn(`Skipping transaction ${tx.id}: no property_id found`);
      skippedCount++;
      continue;
    }

    // Get property's bank GL account
    const { data: property } = await supabaseAdmin
      .from('properties')
      .select('operating_bank_gl_account_id, deposit_trust_gl_account_id')
      .eq('id', propertyId)
      .maybeSingle();

    const bankGlAccountId =
      (property as any)?.operating_bank_gl_account_id ??
      (property as any)?.deposit_trust_gl_account_id ??
      null;

    if (!bankGlAccountId) {
      console.warn(`Skipping transaction ${tx.id}: property has no bank GL account configured`);
      skippedCount++;
      continue;
    }

    // Get lease context for property/unit IDs
    const { data: lease } = await supabaseAdmin
      .from('lease')
      .select('property_id, unit_id, buildium_property_id, buildium_unit_id, buildium_lease_id')
      .eq('id', (tx as any).lease_id)
      .maybeSingle();

    const buildiumLeaseId = (lease as any)?.buildium_lease_id ?? null;
    const txBuildiumLeaseId = (tx as { buildium_lease_id?: number | null }).buildium_lease_id ?? null;

    // Add the missing bank account debit line
    const bankLineData = {
      transaction_id: tx.id,
      gl_account_id: bankGlAccountId,
      amount: creditSum,
      posting_type: 'Debit',
      memo: null,
      account_entity_type: 'Rental' as const,
      account_entity_id: (lease as any)?.buildium_property_id ?? null,
      date: tx.date,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      buildium_property_id: (lease as any)?.buildium_property_id ?? null,
      buildium_unit_id: (lease as any)?.buildium_unit_id ?? null,
      buildium_lease_id: buildiumLeaseId ?? txBuildiumLeaseId ?? null,
      lease_id: (tx as any).lease_id,
      property_id: propertyId,
      unit_id: (lease as any)?.unit_id ?? null,
    };

    const { error: insertError } = await supabaseAdmin
      .from('transaction_lines')
      .insert(bankLineData);

    if (insertError) {
      console.error(`Error adding bank line to transaction ${tx.id}:`, insertError);
      console.error('Line data:', JSON.stringify(bankLineData, null, 2));
      errorCount++;
    } else {
      console.log(
        `✓ Fixed transaction ${tx.id} (${tx.buildium_transaction_id ?? 'no Buildium ID'}, type: ${tx.transaction_type}): Added ${creditSum} debit to bank account ${bankGlAccountId}`,
      );
      fixedCount++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Fixed: ${fixedCount}`);
  console.log(`Skipped: ${skippedCount} (already have bank line or no credits)`);
  console.log(`Errors: ${errorCount}`);
}

fixMissingBankAccountLines()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
