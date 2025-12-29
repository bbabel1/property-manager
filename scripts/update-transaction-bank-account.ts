#!/usr/bin/env npx tsx
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Update a transaction's bank_gl_account_id and bank_gl_account_buildium_id
 * 
 * Usage: npx tsx scripts/update-transaction-bank-account.ts <transactionId> <bankGlAccountId> <bankGlAccountBuildiumId>
 */
import { config } from 'dotenv';
// Prefer `.env` (project convention). Allow override via DOTENV_CONFIG_PATH, and fall back to `.env.local`.
config({ path: process.env.DOTENV_CONFIG_PATH || '.env' });
config({ path: '.env.local', override: false });

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: npx tsx scripts/update-transaction-bank-account.ts <transactionId> <bankGlAccountId> <bankGlAccountBuildiumId>');
    process.exit(1);
  }

  const [transactionId, bankGlAccountId, bankGlAccountBuildiumIdStr] = args;
  const bankGlAccountBuildiumId = parseInt(bankGlAccountBuildiumIdStr, 10);

  if (isNaN(bankGlAccountBuildiumId)) {
    console.error('Error: bank_gl_account_buildium_id must be a valid number');
    process.exit(1);
  }

  const { supabaseAdmin } = await import('../src/lib/db.js');

  console.log(`Fetching transaction ${transactionId}...`);
  const { data: transaction, error: txError } = await supabaseAdmin
    .from('transactions')
    .select('id, transaction_type, bank_gl_account_id, bank_gl_account_buildium_id, buildium_transaction_id')
    .eq('id', transactionId)
    .maybeSingle();

  if (txError) {
    console.error('Failed to fetch transaction:', txError);
    process.exit(1);
  }

  if (!transaction) {
    console.error(`Transaction ${transactionId} not found`);
    process.exit(1);
  }

  console.log('Current transaction state:');
  console.log(`  Transaction Type: ${transaction.transaction_type}`);
  console.log(`  Buildium Transaction ID: ${transaction.buildium_transaction_id ?? 'null'}`);
  console.log(`  Current bank_gl_account_id: ${transaction.bank_gl_account_id ?? 'null'}`);
  console.log(`  Current bank_gl_account_buildium_id: ${transaction.bank_gl_account_buildium_id ?? 'null'}`);

  // Verify bank GL account exists and is a bank account
  if (bankGlAccountId) {
    const { data: glAccount, error: glError } = await supabaseAdmin
      .from('gl_accounts')
      .select('id, name, is_bank_account')
      .eq('id', bankGlAccountId)
      .maybeSingle();

    if (glError) {
      console.error('Failed to verify bank GL account:', glError);
      process.exit(1);
    }

    if (!glAccount) {
      console.error(`Bank GL account ${bankGlAccountId} not found`);
      process.exit(1);
    }

    if (!glAccount.is_bank_account) {
      console.warn(`Warning: GL account ${bankGlAccountId} (${glAccount.name}) is not marked as a bank account`);
    } else {
      console.log(`✓ Verified bank GL account: ${glAccount.name} (${bankGlAccountId})`);
    }
  }

  // Update transaction
  console.log('\nUpdating transaction...');
  const { error: updateError } = await supabaseAdmin
    .from('transactions')
    .update({
      bank_gl_account_id: bankGlAccountId || null,
      bank_gl_account_buildium_id: bankGlAccountBuildiumId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', transactionId);

  if (updateError) {
    console.error('Failed to update transaction:', updateError);
    process.exit(1);
  }

  // Update transaction_lines to use the new bank GL account
  // Find the bank debit line and update it
  if (bankGlAccountId) {
    console.log('Updating transaction lines...');
    const { data: bankLines, error: linesError } = await supabaseAdmin
      .from('transaction_lines')
      .select('id, gl_account_id, posting_type, amount')
      .eq('transaction_id', transactionId)
      .eq('posting_type', 'Debit');

    if (linesError) {
      console.error('Failed to fetch transaction lines:', linesError);
      process.exit(1);
    }

    if (bankLines && bankLines.length > 0) {
      // Update all debit lines that are currently bank accounts
      // First, check which lines are bank accounts
      const bankLineIds: string[] = [];
      for (const line of bankLines) {
        const { data: lineGlAccount } = await supabaseAdmin
          .from('gl_accounts')
          .select('id, is_bank_account')
          .eq('id', line.gl_account_id)
          .maybeSingle();

        if (lineGlAccount?.is_bank_account) {
          bankLineIds.push(line.id);
        }
      }

      // If no bank lines found, update the first debit line
      if (bankLineIds.length === 0 && bankLines.length > 0) {
        bankLineIds.push(bankLines[0].id);
        console.log(`  No bank lines found, updating first debit line: ${bankLines[0].id}`);
      }

      for (const lineId of bankLineIds) {
        const { error: lineUpdateError } = await supabaseAdmin
          .from('transaction_lines')
          .update({
            gl_account_id: bankGlAccountId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', lineId);

        if (lineUpdateError) {
          console.error(`Failed to update transaction line ${lineId}:`, lineUpdateError);
        } else {
          console.log(`  ✓ Updated transaction line ${lineId}`);
        }
      }
    } else {
      console.log('  No debit lines found to update');
    }
  }

  console.log('\n✓ Transaction updated successfully!');
  console.log(`  bank_gl_account_id: ${bankGlAccountId}`);
  console.log(`  bank_gl_account_buildium_id: ${bankGlAccountBuildiumId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
