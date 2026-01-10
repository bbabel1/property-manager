/**
 * Escrow Balance Calculation Functions
 *
 * Handles escrow (security deposit) tracking via GL accounts.
 * Uses the existing transaction_lines table with GL account categories.
 */

import { supabaseAdmin } from '@/lib/db';
import { assertTransactionBalanced, assertTransactionHasBankLine } from '@/lib/accounting-validation';
import type { TablesInsert } from '@/types/database';

export interface EscrowBalance {
  deposits: number;
  withdrawals: number;
  balance: number;
  hasValidGLAccounts: boolean;
}

export interface EscrowMovement {
  id: string;
  date: string;
  memo: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
}

/**
 * Get escrow balance for a unit up to a specific date
 *
 * Queries transaction_lines with GL accounts categorized as 'deposit'.
 * Validates that escrow GL accounts are properly configured.
 *
 * @param unitId - UUID of the unit
 * @param upToDate - ISO date string (YYYY-MM-DD) - include transactions up to this date
 * @returns Escrow balance with validation flag
 */
export async function getEscrowBalance(unitId: string, upToDate: string): Promise<EscrowBalance> {
  // Validate escrow GL accounts exist
  const { data: escrowAccounts, error: accountsError } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, gl_account_category!inner(category)')
    .eq('gl_account_category.category', 'deposit');

  if (accountsError) {
    console.error('Error fetching escrow GL accounts:', accountsError);
    return { deposits: 0, withdrawals: 0, balance: 0, hasValidGLAccounts: false };
  }

  if (!escrowAccounts || escrowAccounts.length === 0) {
    console.error('No escrow GL accounts configured');
    return { deposits: 0, withdrawals: 0, balance: 0, hasValidGLAccounts: false };
  }

  const escrowGLAccountIds = escrowAccounts.map((a) => a.id);

  // Query transaction lines for this unit with escrow GL accounts
  const { data: lines, error: linesError } = await supabaseAdmin
    .from('transaction_lines')
    .select('amount, posting_type')
    .eq('unit_id', unitId)
    .lte('date', upToDate)
    .in('gl_account_id', escrowGLAccountIds);

  if (linesError) {
    console.error('Error fetching escrow transaction lines:', linesError);
    return { deposits: 0, withdrawals: 0, balance: 0, hasValidGLAccounts: true };
  }

  let deposits = 0,
    withdrawals = 0;

  lines?.forEach((line) => {
    if (line.amount === null) return;
    const amt = Math.abs(line.amount);
    // Credit = deposit (liability increases)
    // Debit = withdrawal (liability decreases)
    if (line.posting_type === 'Credit') {
      deposits += amt;
    } else {
      withdrawals += amt;
    }
  });

  return { deposits, withdrawals, balance: deposits - withdrawals, hasValidGLAccounts: true };
}

/**
 * Get escrow movements for a specific time period
 *
 * Returns a detailed list of all escrow transactions for display in the Escrow stage.
 *
 * @param unitId - UUID of the unit
 * @param fromDate - ISO date string (YYYY-MM-DD) - start of period
 * @param toDate - ISO date string (YYYY-MM-DD) - end of period
 * @returns Array of escrow movements
 */
export async function getEscrowMovements(
  unitId: string,
  fromDate: string,
  toDate: string,
): Promise<EscrowMovement[]> {
  // Get escrow GL account IDs
  const { data: escrowAccounts } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, gl_account_category!inner(category)')
    .eq('gl_account_category.category', 'deposit');

  if (!escrowAccounts || escrowAccounts.length === 0) {
    return [];
  }

  const escrowGLAccountIds = escrowAccounts.map((a) => a.id);

  // Query transaction lines for this period
  const { data: lines } = await supabaseAdmin
    .from('transaction_lines')
    .select('id, date, memo, amount, posting_type')
    .eq('unit_id', unitId)
    .gte('date', fromDate)
    .lte('date', toDate)
    .in('gl_account_id', escrowGLAccountIds)
    .order('date', { ascending: true });

  if (!lines) {
    return [];
  }

  return lines.map((line) => ({
    id: line.id,
    date: line.date,
    memo: line.memo || 'Escrow transaction',
    type: line.posting_type === 'Credit' ? 'deposit' : 'withdrawal',
    amount: Math.abs(line.amount ?? 0),
  }));
}

/**
 * Create a new escrow transaction
 *
 * Inserts a transaction_line with the escrow GL account.
 * Used by the Escrow stage when manually recording deposits or withdrawals.
 *
 * @param params - Transaction parameters
 * @returns Created transaction line ID
 */
export async function createEscrowTransaction(params: {
  monthlyLogId: string;
  orgId: string;
  propertyId: string;
  unitId: string;
  buildiumPropertyId?: number | null;
  buildiumUnitId?: number | null;
  bankGlAccountId: string;
  escrowGlAccountId: string;
  date: string;
  memo: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
}): Promise<string> {
  const nowIso = new Date().toISOString();

  const amount = Math.abs(Number(params.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Escrow amount must be greater than zero.');
  }

  const escrowPostingType = params.type === 'deposit' ? 'Credit' : 'Debit';
  const bankPostingType = params.type === 'deposit' ? 'Debit' : 'Credit';

  const transactionInsert: TablesInsert<'transactions'> = {
    date: params.date,
    memo: params.memo,
    total_amount: amount,
    transaction_type: 'GeneralJournalEntry',
    status: 'Paid',
    org_id: params.orgId,
    monthly_log_id: params.monthlyLogId,
    bank_gl_account_id: params.bankGlAccountId,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const { data: transactionRow, error: transactionError } = await supabaseAdmin
    .from('transactions')
    .insert(transactionInsert)
    .select('id')
    .maybeSingle();

  if (transactionError || !transactionRow) {
    console.error('Error creating escrow transaction header:', transactionError);
    throw new Error('Failed to create escrow transaction.');
  }

  const laterIso = new Date(Date.now() + 1000).toISOString();
  const lineRows = [
    {
      transaction_id: transactionRow.id,
      unit_id: params.unitId,
      property_id: params.propertyId,
      gl_account_id: params.escrowGlAccountId,
      date: params.date,
      memo: params.memo,
      amount,
      posting_type: escrowPostingType,
      account_entity_type: 'Rental' as const,
      account_entity_id: params.buildiumPropertyId ?? null,
      buildium_property_id: params.buildiumPropertyId ?? null,
      buildium_unit_id: params.buildiumUnitId ?? null,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      transaction_id: transactionRow.id,
      unit_id: params.unitId,
      property_id: params.propertyId,
      gl_account_id: params.bankGlAccountId,
      date: params.date,
      memo: params.memo,
      amount,
      posting_type: bankPostingType,
      account_entity_type: 'Rental' as const,
      account_entity_id: params.buildiumPropertyId ?? null,
      buildium_property_id: params.buildiumPropertyId ?? null,
      buildium_unit_id: params.buildiumUnitId ?? null,
      created_at: laterIso,
      updated_at: laterIso,
    },
  ];

  const { error: lineError } = await supabaseAdmin.from('transaction_lines').insert(lineRows);
  if (lineError) {
    console.error('Error creating escrow transaction lines:', lineError);
    await supabaseAdmin.from('transactions').delete().eq('id', transactionRow.id);
    throw new Error(`Failed to create escrow transaction lines: ${lineError.message}`);
  }

  try {
    await assertTransactionBalanced(transactionRow.id, supabaseAdmin);
    await assertTransactionHasBankLine(transactionRow.id, supabaseAdmin);
  } catch (validationError) {
    console.error('Escrow transaction validation failed:', validationError);
    await supabaseAdmin.from('transaction_lines').delete().eq('transaction_id', transactionRow.id);
    await supabaseAdmin.from('transactions').delete().eq('id', transactionRow.id);
    throw validationError instanceof Error
      ? validationError
      : new Error('Escrow transaction validation failed.');
  }

  return transactionRow.id;
}

/**
 * Validate escrow GL account configuration
 *
 * Checks that at least one GL account is properly categorized as 'deposit'.
 * Used by the Escrow stage to show configuration warnings.
 *
 * @returns True if escrow accounts are properly configured
 */
export async function validateEscrowConfiguration(): Promise<boolean> {
  const { data: escrowAccounts } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, gl_account_category!inner(category)')
    .eq('gl_account_category.category', 'deposit')
    .limit(1);

  return escrowAccounts !== null && escrowAccounts.length > 0;
}
