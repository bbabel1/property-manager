#!/usr/bin/env npx tsx
/**
 * Diagnostic script to check why Cash Balance doesn't include Trust account transactions
 *
 * Usage: npx tsx scripts/diagnostics/check-property-cash-balance-trust-account.ts <property-id>
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPropertyCashBalance(propertyId: string) {
  console.log(`\n🔍 Checking Cash Balance for property: ${propertyId}\n`);

  // 1. Get property configuration
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select(
      'id, name, operating_bank_gl_account_id, deposit_trust_gl_account_id, cash_balance, available_balance',
    )
    .eq('id', propertyId)
    .single();

  if (propError || !property) {
    console.error('❌ Error fetching property:', propError?.message);
    return;
  }

  console.log('📋 Property Configuration:');
  console.log(`   Name: ${property.name}`);
  console.log(
    `   Operating Bank GL Account ID: ${property.operating_bank_gl_account_id || 'NOT SET'}`,
  );
  console.log(
    `   Deposit Trust GL Account ID: ${property.deposit_trust_gl_account_id || 'NOT SET'}`,
  );
  console.log(`   Cached Cash Balance: $${property.cash_balance || 0}`);
  console.log(`   Cached Available Balance: $${property.available_balance || 0}`);

  // 2. Get GL account names
  const glAccountIds = [
    property.operating_bank_gl_account_id,
    property.deposit_trust_gl_account_id,
  ].filter(Boolean) as string[];

  if (glAccountIds.length > 0) {
    const { data: glAccounts } = await supabase
      .from('gl_accounts')
      .select('id, name, is_bank_account, exclude_from_cash_balances')
      .in('id', glAccountIds);

    console.log('\n🏦 Bank GL Accounts:');
    glAccounts?.forEach((ga) => {
      console.log(`   ${ga.name} (${ga.id})`);
      console.log(`     - is_bank_account: ${ga.is_bank_account}`);
      console.log(`     - exclude_from_cash_balances: ${ga.exclude_from_cash_balances}`);
    });
  }

  // 3. Check transaction_lines for this property
  const { data: propertyLines, error: linesError } = await supabase
    .from('transaction_lines')
    .select(
      `
      id,
      date,
      amount,
      posting_type,
      property_id,
      unit_id,
      lease_id,
      gl_account_id,
      gl_accounts!inner(id, name, is_bank_account, exclude_from_cash_balances)
    `,
    )
    .eq('property_id', propertyId)
    .eq('gl_accounts.is_bank_account', true)
    .eq('gl_accounts.exclude_from_cash_balances', false)
    .order('date', { ascending: false })
    .limit(20);

  if (linesError) {
    console.error('❌ Error fetching property transaction_lines:', linesError.message);
  } else {
    console.log(`\n💵 Property Transaction Lines (bank accounts, last 20):`);
    if (!propertyLines || propertyLines.length === 0) {
      console.log('   No transaction_lines found with property_id set');
    } else {
      let total = 0;
      propertyLines.forEach((line: any) => {
        const ga = line.gl_accounts;
        const amount = line.posting_type === 'Debit' ? line.amount : -line.amount;
        total += amount;
        console.log(
          `   ${line.date} | ${ga.name} | ${line.posting_type} $${line.amount} | Balance: $${total.toFixed(2)}`,
        );
      });
      console.log(`\n   Total from property_id lines: $${total.toFixed(2)}`);
    }
  }

  // 4. Check transaction_lines for unit/lease associations
  const { data: units } = await supabase.from('units').select('id').eq('property_id', propertyId);

  const unitIds = units?.map((u) => u.id) || [];

  if (unitIds.length > 0) {
    const { data: unitLines } = await supabase
      .from('transaction_lines')
      .select(
        `
        id,
        date,
        amount,
        posting_type,
        unit_id,
        gl_account_id,
        gl_accounts!inner(id, name, is_bank_account, exclude_from_cash_balances)
      `,
      )
      .in('unit_id', unitIds)
      .eq('gl_accounts.is_bank_account', true)
      .eq('gl_accounts.exclude_from_cash_balances', false)
      .order('date', { ascending: false })
      .limit(10);

    console.log(`\n🏠 Unit Transaction Lines (bank accounts, last 10):`);
    if (!unitLines || unitLines.length === 0) {
      console.log('   No transaction_lines found via unit_id');
    } else {
      let total = 0;
      unitLines.forEach((line: any) => {
        const ga = line.gl_accounts;
        const amount = line.posting_type === 'Debit' ? line.amount : -line.amount;
        total += amount;
        console.log(
          `   ${line.date} | ${ga.name} | ${line.posting_type} $${line.amount} | Balance: $${total.toFixed(2)}`,
        );
      });
    }
  }

  // 5. Check transaction_lines posted directly to bank GL accounts (without property_id/unit_id/lease_id)
  if (glAccountIds.length > 0) {
    const { data: bankGlLines } = await supabase
      .from('transaction_lines')
      .select(
        `
        id,
        date,
        amount,
        posting_type,
        property_id,
        unit_id,
        lease_id,
        gl_account_id,
        gl_accounts!inner(id, name, is_bank_account, exclude_from_cash_balances)
      `,
      )
      .in('gl_account_id', glAccountIds)
      .is('property_id', null)
      .is('unit_id', null)
      .is('lease_id', null)
      .eq('gl_accounts.is_bank_account', true)
      .eq('gl_accounts.exclude_from_cash_balances', false)
      .order('date', { ascending: false })
      .limit(20);

    console.log(`\n🏦 Bank GL Account Lines (no property_id/unit_id/lease_id, last 20):`);
    if (!bankGlLines || bankGlLines.length === 0) {
      console.log('   No transaction_lines found posted directly to bank GL accounts');
    } else {
      let total = 0;
      bankGlLines.forEach((line: any) => {
        const ga = line.gl_accounts;
        const amount = line.posting_type === 'Debit' ? line.amount : -line.amount;
        total += amount;
        console.log(
          `   ${line.date} | ${ga.name} | ${line.posting_type} $${line.amount} | Balance: $${total.toFixed(2)}`,
        );
      });
      console.log(`\n   Total from direct bank GL lines: $${total.toFixed(2)}`);
    }
  }

  // 6. Call get_property_financials function
  const today = new Date().toISOString().slice(0, 10);
  const { data: finData, error: finError } = await supabase.rpc('get_property_financials', {
    p_property_id: propertyId,
    p_as_of: today,
  });

  if (finError) {
    console.error('\n❌ Error calling get_property_financials:', finError.message);
  } else {
    console.log(`\n💰 get_property_financials(${propertyId}, ${today}):`);
    console.log(`   Cash Balance: $${finData?.cash_balance || 0}`);
    console.log(`   Security Deposits: $${finData?.security_deposits || 0}`);
    console.log(`   Reserve: $${finData?.reserve || 0}`);
    console.log(`   Available Balance: $${finData?.available_balance || 0}`);
    if (finData?._debug) {
      console.log(`\n   Debug Info:`);
      console.log(`     Bank Total (complex): $${finData._debug.bank_total_complex || 0}`);
      console.log(`     Bank Total (simple): $${finData._debug.bank_total_simple || 0}`);
      console.log(`     Payments Total: $${finData._debug.payments_total || 0}`);
      console.log(`     Bank Line Count: ${finData._debug.bank_line_count || 0}`);
      console.log(`     Bank Debits Total: $${finData._debug.bank_debits_total || 0}`);
      console.log(`     Bank Credits Total: $${finData._debug.bank_credits_total || 0}`);
    }
  }

  console.log('\n✅ Diagnostic complete!\n');
}

const propertyId = process.argv[2];
if (!propertyId) {
  console.error(
    'Usage: npx tsx scripts/diagnostics/check-property-cash-balance-trust-account.ts <property-id>',
  );
  process.exit(1);
}

checkPropertyCashBalance(propertyId).catch(console.error);

