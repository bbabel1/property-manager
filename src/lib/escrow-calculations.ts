/**
 * Escrow Balance Calculation Functions
 *
 * Handles escrow (security deposit) tracking via GL accounts.
 * Uses the existing transaction_lines table with GL account categories.
 */

import { supabaseAdmin } from '@/lib/db';

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
  unitId: string;
  date: string;
  memo: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
}): Promise<string> {
  // Get the first escrow GL account
  const { data: escrowAccounts } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, gl_account_category!inner(category)')
    .eq('gl_account_category.category', 'deposit')
    .limit(1)
    .single();

  if (!escrowAccounts) {
    throw new Error(
      'No escrow GL account configured. Please contact administrator to set up security deposit accounts.',
    );
  }

  // Determine posting type based on transaction type
  const postingType = params.type === 'deposit' ? 'Credit' : 'Debit';

  // Insert transaction line
  const { data, error } = await supabaseAdmin
    .from('transaction_lines')
    .insert({
      unit_id: params.unitId,
      gl_account_id: escrowAccounts.id,
      date: params.date,
      memo: params.memo,
      amount: params.amount,
      posting_type: postingType,
      account_entity_type: 'Rental',
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating escrow transaction:', error);
    throw new Error(`Failed to create escrow transaction: ${error.message}`);
  }

  return data.id;
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
