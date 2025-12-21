import { signedAmountFromTransaction } from './finance/model';

type LeaseBalances = { balance?: number; prepayments?: number; depositsHeld?: number };

/**
 * Derive lease balances, falling back to local transactions when the remote balance is zero.
 */
export const resolveLeaseBalances = (
  balances: LeaseBalances,
  transactions: unknown[],
): { balance: number; prepayments: number; depositsHeld: number } => {
  const normalized = {
    balance: Number(balances?.balance ?? 0) || 0,
    prepayments: Number(balances?.prepayments ?? 0) || 0,
    depositsHeld: Number(balances?.depositsHeld ?? 0) || 0,
  };

  if (!normalized.balance && Array.isArray(transactions) && transactions.length) {
    const localBalance = transactions.reduce(
      (sum: number, tx) => sum + signedAmountFromTransaction(tx as any),
      0,
    );
    normalized.balance = localBalance;
  }

  return normalized;
};
