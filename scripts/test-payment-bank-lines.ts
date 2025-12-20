#!/usr/bin/env npx tsx
/**
 * Test script to verify that Payment and ApplyDeposit transactions have bank account lines
 * and that the cash balance calculation is working correctly.
 */

// Load environment variables BEFORE any imports
import { config } from 'dotenv';
config({ path: '.env.local' });

async function testPaymentBankLines() {
  // Dynamic import to ensure env vars are loaded first
  const { supabaseAdmin } = await import('../src/lib/db.js');
  console.log('Testing Payment and ApplyDeposit transactions for bank account lines...\n');

  // Find all Payment and ApplyDeposit transactions
  const { data: transactions, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('id, lease_id, total_amount, date, buildium_transaction_id, transaction_type')
    .in('transaction_type', ['Payment', 'ApplyDeposit'])
    .order('date', { ascending: false });

  if (txError) {
    console.error('Error fetching transactions:', txError);
    process.exit(1);
  }

  console.log(`Found ${transactions?.length ?? 0} recent Payment/ApplyDeposit transactions\n`);

  let withBankLines = 0;
  let missingBankLines = 0;
  const missingDetails: Array<{
    transactionId: string;
    type: string;
    date: string;
    creditSum: number;
    propertyId: string | null;
    hasBankAccount: boolean;
  }> = [];

  for (const tx of transactions ?? []) {
    // Get all transaction lines for this transaction
    const { data: lines, error: linesError } = await supabaseAdmin
      .from('transaction_lines')
      .select('id, gl_account_id, amount, posting_type, gl_accounts(id, name, is_bank_account)')
      .eq('transaction_id', tx.id);

    if (linesError) {
      console.error(`Error fetching lines for transaction ${tx.id}:`, linesError);
      continue;
    }

    // Check if there's a bank account line
    const bankLines = (lines ?? []).filter((line) =>
      Boolean((line.gl_accounts as any)?.is_bank_account),
    );
    const hasBankLine = bankLines.length > 0;

    // Calculate credit sum
    const creditSum = (lines ?? [])
      .filter((line) => line.posting_type === 'Credit')
      .reduce((sum, line) => sum + Number(line.amount ?? 0), 0);

    // Get property ID from lease
    let propertyId = null;
    if ((tx as any).lease_id) {
      const { data: lease } = await supabaseAdmin
        .from('lease')
        .select('property_id')
        .eq('id', (tx as any).lease_id)
        .maybeSingle();
      propertyId = (lease as any)?.property_id ?? null;
    }

    // Check if property has bank account configured
    let hasBankAccount = false;
    if (propertyId) {
      const { data: property } = await supabaseAdmin
        .from('properties')
        .select('operating_bank_gl_account_id, deposit_trust_gl_account_id')
        .eq('id', propertyId)
        .maybeSingle();
      hasBankAccount =
        Boolean((property as any)?.operating_bank_gl_account_id) ||
        Boolean((property as any)?.deposit_trust_gl_account_id);
    }

    if (hasBankLine) {
      withBankLines++;
      console.log(
        `✓ Transaction ${tx.id} (${tx.transaction_type}, ${tx.date}): Has ${bankLines.length} bank line(s), ${lines?.length ?? 0} total lines`,
      );
    } else if (creditSum > 0) {
      missingBankLines++;
      missingDetails.push({
        transactionId: tx.id,
        type: tx.transaction_type,
        date: tx.date,
        creditSum,
        propertyId,
        hasBankAccount,
      });
      console.log(
        `✗ Transaction ${tx.id} (${tx.transaction_type}, ${tx.date}): Missing bank line! Credit sum: ${creditSum}, Property has bank: ${hasBankAccount}`,
      );
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Transactions with bank lines: ${withBankLines}`);
  console.log(`Transactions missing bank lines: ${missingBankLines}`);

  if (missingDetails.length > 0) {
    console.log(`\n=== Missing Bank Lines Details ===`);
    for (const detail of missingDetails) {
      console.log(
        `- ${detail.transactionId} (${detail.type}, ${detail.date}): Credit ${detail.creditSum}, Property: ${detail.propertyId}, Has Bank Config: ${detail.hasBankAccount}`,
      );
    }
    console.log(
      `\nRun the backfill script to fix these: npx tsx scripts/fix-missing-bank-account-lines.ts`,
    );
  } else {
    console.log(`\n✓ All transactions have bank account lines!`);
  }

  // Test cash balance calculation for a specific property
  if (missingDetails.length > 0 && missingDetails[0].propertyId) {
    const testPropertyId = missingDetails[0].propertyId;
    console.log(`\n=== Testing Cash Balance for Property ${testPropertyId} ===`);

    const { data: property } = await supabaseAdmin
      .from('properties')
      .select('operating_bank_gl_account_id, deposit_trust_gl_account_id')
      .eq('id', testPropertyId)
      .maybeSingle();

    const bankGlAccountIds = [
      (property as any)?.operating_bank_gl_account_id,
      (property as any)?.deposit_trust_gl_account_id,
    ].filter(Boolean);

    if (bankGlAccountIds.length > 0) {
      const { data: bankLines } = await supabaseAdmin
        .from('transaction_lines')
        .select('amount, posting_type, date')
        .in('gl_account_id', bankGlAccountIds)
        .eq('property_id', testPropertyId)
        .order('date', { ascending: false })
        .limit(10);

      console.log(`Recent bank account lines for property:`);
      (bankLines ?? []).forEach((line) => {
        const signedAmount =
          line.posting_type === 'Debit' ? Number(line.amount) : -Number(line.amount);
        console.log(
          `  ${line.date}: ${line.posting_type} ${line.amount} (signed: ${signedAmount > 0 ? '+' : ''}${signedAmount})`,
        );
      });
    }
  }
}

testPaymentBankLines()
  .then(() => {
    console.log('\nTest complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

