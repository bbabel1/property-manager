import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';

const DEFAULT_TOLERANCE = 0.01;

const normalizeAmount = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function assertTransactionBalanced(
  transactionId: string,
  db: TypedSupabaseClient = supabaseAdmin,
  tolerance: number = DEFAULT_TOLERANCE,
): Promise<void> {
  const { data: lines, error } = await db
    .from('transaction_lines')
    .select('amount, posting_type')
    .eq('transaction_id', transactionId);

  if (error) {
    throw new Error(`Failed to validate transaction lines: ${error.message}`);
  }

  const { debits, credits } = (lines ?? []).reduce(
    (acc, line) => {
      const amount = Math.abs(normalizeAmount((line as any)?.amount));
      const postingType = String((line as any)?.posting_type ?? '');
      if (postingType === 'Debit') acc.debits += amount;
      if (postingType === 'Credit') acc.credits += amount;
      return acc;
    },
    { debits: 0, credits: 0 },
  );

  if (Math.abs(debits - credits) > tolerance) {
    throw new Error(
      `Transaction is unbalanced (debits=${debits.toFixed(2)}, credits=${credits.toFixed(2)}).`,
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

