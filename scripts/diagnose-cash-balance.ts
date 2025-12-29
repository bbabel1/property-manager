#!/usr/bin/env npx tsx
/**
 * Comprehensive cash balance diagnostic
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

async function diagnoseCashBalance() {
  const { supabaseAdmin } = await import('../src/lib/db.js');

  // Get property ID from command line or use default
  const propertyId = process.argv[2] || 'ac2a17f5-ae71-4066-8568-03bfb8bd505c';

  console.log(`=== Cash Balance Diagnostic for Property ${propertyId} ===\n`);

  // Get property details
  const { data: property } = await supabaseAdmin
    .from('properties')
    .select('id, name, operating_bank_gl_account_id, deposit_trust_gl_account_id')
    .eq('id', propertyId)
    .maybeSingle();

  if (!property) {
    console.error('Property not found');
    process.exit(1);
  }

  console.log(`Property: ${property.name || propertyId}`);
  console.log(`Operating Bank: ${(property as any).operating_bank_gl_account_id || 'Not set'}`);
  console.log(`Deposit Trust: ${(property as any).deposit_trust_gl_account_id || 'Not set'}\n`);

  // Get bank GL account details
  const bankGlAccountIds = [
    (property as any).operating_bank_gl_account_id,
    (property as any).deposit_trust_gl_account_id,
  ].filter(Boolean);

  if (bankGlAccountIds.length === 0) {
    console.error('Property has no bank accounts configured!');
    process.exit(1);
  }

  const { data: bankAccounts } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, name, bank_account_number, is_bank_account')
    .in('id', bankGlAccountIds);

  console.log('Bank GL Accounts:');
  (bankAccounts ?? []).forEach((acc) => {
    console.log(`  - ${acc.name} (${acc.id}): is_bank_account=${acc.is_bank_account}`);
  });
  console.log();

  // Get all transactions for property (via lease)
  const { data: leases } = await supabaseAdmin
    .from('lease')
    .select('id, buildium_lease_id')
    .eq('property_id', propertyId);

  const leaseIds = (leases ?? []).map((l) => l.id);

  console.log(`Found ${leaseIds.length} leases for this property\n`);

  // Get all transactions
  const { data: allTransactions } = await supabaseAdmin
    .from('transactions')
    .select('id, transaction_type, total_amount, date, buildium_transaction_id, lease_id')
    .in('lease_id', leaseIds as any)
    .order('date', { ascending: false });

  console.log(`=== All Transactions (${allTransactions?.length ?? 0}) ===\n`);

  let paymentsTotal = 0;
  let depositsTotal = 0;

  for (const tx of allTransactions ?? []) {
    const { data: lines } = await supabaseAdmin
      .from('transaction_lines')
      .select('id, gl_account_id, amount, posting_type, gl_accounts(name, is_bank_account)')
      .eq('transaction_id', tx.id);

    const bankLines = (lines ?? []).filter((l) => Boolean((l.gl_accounts as any)?.is_bank_account));
    const hasBankLine = bankLines.length > 0;
    const creditSum = (lines ?? [])
      .filter((l) => l.posting_type === 'Credit')
      .reduce((sum, l) => sum + Number(l.amount ?? 0), 0);

    if (tx.transaction_type === 'Payment') paymentsTotal += Math.abs(tx.total_amount);
    if (tx.transaction_type === 'ApplyDeposit') depositsTotal += Math.abs(tx.total_amount);

    console.log(
      `${tx.date} | ${tx.transaction_type.padEnd(15)} | ${String(tx.total_amount).padStart(8)} | Lines: ${lines?.length ?? 0} | Bank: ${hasBankLine ? '✓' : '✗'} | Credits: ${creditSum}`,
    );

    if (!hasBankLine && creditSum > 0) {
      console.log(`  ⚠️  Missing bank line! Transaction ID: ${tx.id}`);
    }

    if (bankLines.length > 0) {
      bankLines.forEach((bl) => {
        const signed = bl.posting_type === 'Debit' ? Number(bl.amount) : -Number(bl.amount);
        console.log(
          `     Bank: ${bl.posting_type} ${bl.amount} (${signed > 0 ? '+' : ''}${signed})`,
        );
      });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Payments Total: $${paymentsTotal}`);
  console.log(`Deposits Total: $${depositsTotal}`);

  // Calculate bank balance directly
  const { data: allBankLines } = await supabaseAdmin
    .from('transaction_lines')
    .select('amount, posting_type, date, transaction_id')
    .in('gl_account_id', bankGlAccountIds);

  let bankBalance = 0;
  console.log(`\n=== Bank Account Lines (${allBankLines?.length ?? 0}) ===\n`);

  (allBankLines ?? []).forEach((line) => {
    const signed = line.posting_type === 'Debit' ? Number(line.amount) : -Number(line.amount);
    bankBalance += signed;
    console.log(
      `${line.date} | ${line.posting_type.padEnd(6)} | ${String(line.amount).padStart(8)} | Signed: ${signed > 0 ? '+' : ''}${signed} | Balance: ${bankBalance}`,
    );
  });

  console.log(`\n=== Calculated Bank Balance: $${bankBalance} ===`);

  // Get RPC financials
  const { data: rpcFin } = await supabaseAdmin.rpc('get_property_financials', {
    p_property_id: propertyId,
    p_as_of: new Date().toISOString().slice(0, 10),
  });

  console.log(`\n=== RPC Financials ===`);
  console.log(`Cash Balance: $${(rpcFin as any)?.cash_balance ?? 'null'}`);
  console.log(`Security Deposits: $${(rpcFin as any)?.security_deposits ?? 'null'}`);
  console.log(`Available Balance: $${(rpcFin as any)?.available_balance ?? 'null'}`);
}

diagnoseCashBalance()
  .then(() => {
    console.log('\nDiagnostic complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
