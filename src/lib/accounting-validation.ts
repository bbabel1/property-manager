import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';

/**
 * Standardized tolerance for double-entry balance validation.
 * 0.01 represents 1 cent, which is appropriate for currency transactions.
 * This constant should be used consistently across all balance validation.
 */
export const DOUBLE_ENTRY_TOLERANCE = 0.01;

const normalizeAmount = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Validates that a transaction follows double-entry bookkeeping principles:
 * 1. Must have at least one debit line and one credit line
 * 2. Total debits must equal total credits (within tolerance)
 *
 * @param transactionId - The transaction ID to validate
 * @param db - Supabase client (defaults to admin client)
 * @param tolerance - Tolerance for balance difference (defaults to DOUBLE_ENTRY_TOLERANCE)
 * @throws Error if transaction is unbalanced or missing required posting types
 */
export async function assertTransactionBalanced(
  transactionId: string,
  db: TypedSupabaseClient = supabaseAdmin,
  tolerance: number = DOUBLE_ENTRY_TOLERANCE,
): Promise<void> {
  const { data: lines, error } = await db
    .from('transaction_lines')
    .select('amount, posting_type')
    .eq('transaction_id', transactionId);

  if (error) {
    throw new Error(`Failed to validate transaction lines: ${error.message}`);
  }

  const { debits, credits, debitCount, creditCount } = (lines ?? []).reduce(
    (acc, line) => {
      const amount = Math.abs(normalizeAmount((line as any)?.amount));
      const postingType = String((line as any)?.posting_type ?? '').trim();
      if (postingType === 'Debit') {
        acc.debits += amount;
        acc.debitCount += 1;
      }
      if (postingType === 'Credit') {
        acc.credits += amount;
        acc.creditCount += 1;
      }
      return acc;
    },
    { debits: 0, credits: 0, debitCount: 0, creditCount: 0 },
  );

  // Require at least one debit and one credit line
  if (debitCount === 0 || creditCount === 0) {
    throw new Error(
      `Transaction must have at least one debit and one credit line (found ${debitCount} debits, ${creditCount} credits).`,
    );
  }

  // Validate balance within tolerance
  const difference = Math.abs(debits - credits);
  if (difference > tolerance) {
    throw new Error(
      `Transaction is unbalanced (debits=${debits.toFixed(2)}, credits=${credits.toFixed(2)}, difference=${difference.toFixed(2)}, tolerance=${tolerance}).`,
    );
  }
}

export async function assertTransactionHasBankLine(
  transactionId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<void> {
  const { data: lines, error } = await db
    .from('transaction_lines')
    .select('gl_account_id')
    .eq('transaction_id', transactionId);

  if (error) {
    throw new Error(`Failed to validate bank line: ${error.message}`);
  }

  const glAccountIds = Array.from(
    new Set(
      (lines ?? [])
        .map((line) => (line as any)?.gl_account_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );

  if (glAccountIds.length === 0) {
    throw new Error('Transaction has no GL lines.');
  }

  const { data: glAccounts, error: glError } = await db
    .from('gl_accounts')
    .select('id, is_bank_account')
    .in('id', glAccountIds);

  if (glError) {
    throw new Error(`Failed to validate GL accounts: ${glError.message}`);
  }

  const hasBankAccount = (glAccounts ?? []).some((acc) => Boolean((acc as any)?.is_bank_account));
  if (!hasBankAccount) {
    throw new Error('Transaction is missing a bank account line.');
  }
}
