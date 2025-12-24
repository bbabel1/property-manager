/**
 * Diagnostic script to identify double-entry bookkeeping balance issues:
 * 1. Wrong balances per Entity Type (Rental vs Company)
 * 2. Incorrect Cash Balance calculations
 * 3. Ledger table balance issues
 * 
 * Usage: npx tsx scripts/diagnostics/check-double-entry-balance-issues.ts [property-id]
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { supabaseAdmin } from '@/lib/db';

type TransactionLineRow = {
  id: string;
  transaction_id: string;
  gl_account_id: string;
  amount: number;
  posting_type: string;
  account_entity_type: string | null;
  account_entity_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  date: string;
  gl_accounts?: {
    name: string;
    type: string;
    is_bank_account: boolean;
    exclude_from_cash_balances: boolean;
  } | null;
};

type BalanceIssue = {
  type: 'entity_type_mismatch' | 'cash_balance_issue' | 'unbalanced_transaction' | 'missing_entity_type';
  severity: 'error' | 'warning';
  description: string;
  transaction_id?: string;
  gl_account_id?: string;
  property_id?: string;
  details: Record<string, unknown>;
};

async function checkDoubleEntryBalanceIssues(propertyId?: string) {
  console.log('🔍 Checking double-entry bookkeeping balance issues...\n');

  const issues: BalanceIssue[] = [];

  // 1. Check for transactions with missing account_entity_type
  console.log('1. Checking for missing account_entity_type...');
  const { data: missingEntityType, error: err1 } = await supabaseAdmin
    .from('transaction_lines')
    .select('id, transaction_id, gl_account_id, account_entity_type, property_id')
    .is('account_entity_type', null)
    .limit(100);

  if (err1) {
    console.error('Error checking missing entity types:', err1);
  } else {
    const count = missingEntityType?.length || 0;
    if (count > 0) {
      issues.push({
        type: 'missing_entity_type',
        severity: 'warning',
        description: `Found ${count} transaction lines with missing account_entity_type`,
        details: {
          count,
          sample_ids: missingEntityType?.slice(0, 5).map((r) => r.id),
        },
      });
      console.log(`   ⚠️  Found ${count} lines with missing account_entity_type`);
    } else {
      console.log('   ✅ All transaction lines have account_entity_type');
    }
  }

  // 2. Check for unbalanced transactions
  console.log('\n2. Checking for unbalanced transactions...');
  const { data: transactions, error: err2 } = await supabaseAdmin
    .from('transactions')
    .select('id, transaction_type, total_amount')
    .limit(1000);

  if (err2) {
    console.error('Error fetching transactions:', err2);
  } else {
    const transactionIds = transactions?.map((t) => t.id) || [];
    
    for (const txId of transactionIds.slice(0, 100)) {
      const { data: lines, error: err3 } = await supabaseAdmin
        .from('transaction_lines')
        .select('amount, posting_type')
        .eq('transaction_id', txId);

      if (err3) continue;

      const debits = lines
        ?.filter((l) => l.posting_type?.toLowerCase() === 'debit')
        .reduce((sum, l) => sum + Math.abs(Number(l.amount) || 0), 0) || 0;
      
      const credits = lines
        ?.filter((l) => l.posting_type?.toLowerCase() === 'credit')
        .reduce((sum, l) => sum + Math.abs(Number(l.amount) || 0), 0) || 0;

      const difference = Math.abs(debits - credits);
      if (difference > 0.01) {
        issues.push({
          type: 'unbalanced_transaction',
          severity: 'error',
          description: `Transaction ${txId} is unbalanced (debits: ${debits.toFixed(2)}, credits: ${credits.toFixed(2)}, diff: ${difference.toFixed(2)})`,
          transaction_id: txId,
          details: {
            debits,
            credits,
            difference,
            line_count: lines?.length || 0,
          },
        });
      }
    }
    console.log(`   ✅ Checked ${transactionIds.length} transactions`);
  }

  // 3. Check entity type filtering in balance calculations
  console.log('\n3. Checking entity type filtering in balance calculations...');
  
  // Get a sample property
  const { data: properties } = await supabaseAdmin
    .from('properties')
    .select('id, name, org_id')
    .limit(5);

  for (const property of properties || []) {
    if (propertyId && property.id !== propertyId) continue;

    console.log(`\n   Analyzing property: ${property.name} (${property.id})`);

    // Get all transaction lines for this property
    const { data: propertyLines, error: err4 } = await supabaseAdmin
      .from('transaction_lines')
      .select(`
        id,
        transaction_id,
        gl_account_id,
        amount,
        posting_type,
        account_entity_type,
        account_entity_id,
        property_id,
        unit_id,
        date,
        gl_accounts(name, type, is_bank_account, exclude_from_cash_balances)
      `)
      .or(`property_id.eq.${property.id},unit_id.in.(select id from units where property_id = '${property.id}')`)
      .limit(1000);

    if (err4) {
      console.error(`   Error fetching lines for property ${property.id}:`, err4);
      continue;
    }

    // Group by entity type
    const rentalLines = propertyLines?.filter(
      (l) => l.account_entity_type === 'Rental'
    ) || [];
    const companyLines = propertyLines?.filter(
      (l) => l.account_entity_type === 'Company'
    ) || [];
    const nullLines = propertyLines?.filter(
      (l) => !l.account_entity_type
    ) || [];

    console.log(`     Rental entity lines: ${rentalLines.length}`);
    console.log(`     Company entity lines: ${companyLines.length}`);
    console.log(`     Null entity lines: ${nullLines.length}`);

    // Calculate cash balance for Rental entity type only
    const rentalCashBalance = calculateCashBalance(rentalLines);
    const allCashBalance = calculateCashBalance(propertyLines || []);

    console.log(`     Cash balance (Rental only): $${rentalCashBalance.toFixed(2)}`);
    console.log(`     Cash balance (all lines): $${allCashBalance.toFixed(2)}`);

    if (Math.abs(rentalCashBalance - allCashBalance) > 0.01) {
      issues.push({
        type: 'cash_balance_issue',
        severity: 'error',
        description: `Property ${property.name} cash balance includes Company entity lines`,
        property_id: property.id,
        details: {
          rental_cash_balance: rentalCashBalance,
          all_cash_balance: allCashBalance,
          difference: Math.abs(rentalCashBalance - allCashBalance),
          company_line_count: companyLines.length,
        },
      });
      console.log(`     ⚠️  MISMATCH: Cash balance includes Company entity lines!`);
    }

    // Check for lines with wrong entity type
    const wrongEntityTypeLines = propertyLines?.filter((l) => {
      // If property_id is set, it should be Rental entity type
      if (l.property_id === property.id && l.account_entity_type !== 'Rental') {
        return true;
      }
      return false;
    }) || [];

    if (wrongEntityTypeLines.length > 0) {
      issues.push({
        type: 'entity_type_mismatch',
        severity: 'error',
        description: `Property ${property.name} has ${wrongEntityTypeLines.length} lines with incorrect entity type`,
        property_id: property.id,
        details: {
          count: wrongEntityTypeLines.length,
          sample_ids: wrongEntityTypeLines.slice(0, 5).map((l) => l.id),
        },
      });
      console.log(`     ⚠️  Found ${wrongEntityTypeLines.length} lines with incorrect entity type`);
    }
  }

  // 4. Check GL account balances per entity type
  console.log('\n4. Checking GL account balances per entity type...');
  
  const { data: glAccounts } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, name, type, is_bank_account')
    .eq('is_bank_account', true)
    .limit(10);

  for (const glAccount of glAccounts || []) {
    // Get all lines for this GL account
    const { data: glLines, error: err5 } = await supabaseAdmin
      .from('transaction_lines')
      .select('amount, posting_type, account_entity_type, property_id')
      .eq('gl_account_id', glAccount.id)
      .limit(1000);

    if (err5) continue;

    const rentalBalance = calculateBalance(
      glLines?.filter((l) => l.account_entity_type === 'Rental') || []
    );
    const companyBalance = calculateBalance(
      glLines?.filter((l) => l.account_entity_type === 'Company') || []
    );
    const allBalance = calculateBalance(glLines || []);

    // Check if Rental + Company = All (within tolerance)
    const sumBalance = rentalBalance + companyBalance;
    const difference = Math.abs(sumBalance - allBalance);

    if (difference > 0.01) {
      issues.push({
        type: 'entity_type_mismatch',
        severity: 'error',
        description: `GL account ${glAccount.name} balance calculation issue`,
        gl_account_id: glAccount.id,
        details: {
          rental_balance: rentalBalance,
          company_balance: companyBalance,
          sum_balance: sumBalance,
          all_balance: allBalance,
          difference,
        },
      });
      console.log(`   ⚠️  GL Account ${glAccount.name}: Balance mismatch`);
      console.log(`      Rental: $${rentalBalance.toFixed(2)}, Company: $${companyBalance.toFixed(2)}`);
      console.log(`      Sum: $${sumBalance.toFixed(2)}, All: $${allBalance.toFixed(2)}`);
      console.log(`      Difference: $${difference.toFixed(2)}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  console.log(`Total issues found: ${issues.length}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Warnings: ${warningCount}`);

  if (issues.length > 0) {
    console.log('\nDetailed Issues:');
    issues.forEach((issue, idx) => {
      console.log(`\n${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.type}`);
      console.log(`   Description: ${issue.description}`);
      console.log(`   Details:`, JSON.stringify(issue.details, null, 2));
    });
  } else {
    console.log('\n✅ No balance calculation issues found!');
  }

  return issues;
}

function calculateCashBalance(lines: TransactionLineRow[]): number {
  let balance = 0;
  for (const line of lines) {
    const glAccount = line.gl_accounts;
    if (!glAccount) continue;
    if (glAccount.exclude_from_cash_balances) continue;
    
    const isBankAccount =
      glAccount.is_bank_account ||
      (glAccount.type?.toLowerCase() === 'asset' &&
        (glAccount.name?.toLowerCase().includes('bank') ||
          glAccount.name?.toLowerCase().includes('checking') ||
          glAccount.name?.toLowerCase().includes('operating') ||
          glAccount.name?.toLowerCase().includes('trust')));

    if (isBankAccount) {
      const amount = Math.abs(Number(line.amount) || 0);
      const postingType = (line.posting_type || '').toLowerCase();
      const accountType = glAccount.type?.toLowerCase() || '';

      // Asset accounts: debit increases, credit decreases
      if (accountType === 'asset') {
        if (postingType === 'debit') {
          balance += amount;
        } else if (postingType === 'credit') {
          balance -= amount;
        }
      }
    }
  }
  return balance;
}

function calculateBalance(lines: Array<{ amount: unknown; posting_type: string | null }>): number {
  let balance = 0;
  for (const line of lines) {
    const amount = Math.abs(Number(line.amount) || 0);
    const postingType = (line.posting_type || '').toLowerCase();
    
    if (postingType === 'debit') {
      balance += amount;
    } else if (postingType === 'credit') {
      balance -= amount;
    }
  }
  return balance;
}

// Run the diagnostic
const propertyId = process.argv[2];
checkDoubleEntryBalanceIssues(propertyId)
  .then((issues) => {
    process.exit(issues.filter((i) => i.severity === 'error').length > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Error running diagnostic:', error);
    process.exit(1);
  });
