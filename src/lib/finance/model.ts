type MaybeNumber = number | string | null | undefined;

type BasicAccount = {
  type?: string | null;
  sub_type?: string | null;
  name?: string | null;
  gl_account_category?: { category?: string | null } | null;
  is_bank_account?: boolean | null;
  is_security_deposit_liability?: boolean | null;
  exclude_from_cash_balances?: boolean | null;
};

type BasicLine = {
  amount?: MaybeNumber;
  posting_type?: string | null;
  gl_accounts?: BasicAccount | null;
  transaction_id?: string | number | null;
  property_id?: string | null;
  unit_id?: string | null;
  account_entity_type?: 'Rental' | 'Company' | string | null;
};

type BasicTransaction = {
  id?: string | number | null;
  TransactionTypeEnum?: unknown;
  TransactionType?: unknown;
  transaction_type?: unknown;
  type?: unknown;
  total_amount?: MaybeNumber;
  TotalAmount?: MaybeNumber;
  amount?: MaybeNumber;
  Amount?: MaybeNumber;
  transaction_lines?: BasicLine[] | null;
  Lines?: BasicLine[] | null;
  Journal?: { Lines?: BasicLine[] | null } | null;
};

export type FinanceRollupParams = {
  transactionLines?: BasicLine[];
  transactions?: BasicTransaction[];
  unitBalances?: {
    balance?: MaybeNumber;
    deposits_held_balance?: MaybeNumber;
    prepayments_balance?: MaybeNumber;
  };
  propertyReserve?: MaybeNumber;
  today?: Date;
  entityType?: 'Rental' | 'Company' | null;
};

export type FinanceRollupResult = {
  fin: {
    cash_balance: number;
    security_deposits: number;
    prepayments: number;
    reserve: number;
    available_balance: number;
    as_of: string;
  };
  debug: {
    totals: {
      bank: number;
      deposits: number;
      prepayments: number;
      payments: number;
      depositsFromPayments: number;
      prepaymentsFromPayments: number;
      arFallback: number;
    };
    usedBankBalance: boolean;
    usedPaymentFallback: boolean;
    usedArFallback: boolean;
    incompleteBankLines: boolean;
    bankLineCount: number;
  };
};

const normalizeNumber = (value: MaybeNumber): number => {
  const num = typeof value === 'string' ? Number(value) : Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
};

const isDebitNormal = (accountType?: string | null): boolean => {
  const type = (accountType || '').toLowerCase();
  return type === 'asset' || type === 'expense';
};

const signedByNormalBalance = (
  amount: number,
  postingType?: string | null,
  accountType?: string | null,
): number => {
  if (!amount) return 0;
  const posting = (postingType || '').toLowerCase();
  const debit = posting === 'debit';
  const credit = posting === 'credit';
  const debitNormal = isDebitNormal(accountType);

  if (debitNormal) {
    if (debit) return amount;
    if (credit) return -amount;
  } else {
    if (debit) return -amount;
    if (credit) return amount;
  }

  // Fallback: assume debit increases
  return debit ? amount : -amount;
};

const isBankAccount = (account?: BasicAccount | null): boolean => {
  if (!account) return false;
  if (account.exclude_from_cash_balances) return false;
  const type = (account.type || '').toLowerCase();
  const subType = (account.sub_type || '').toLowerCase();
  const name = (account.name || '').toLowerCase();
  const normalizedSubType = subType.replace(/[\s_-]+/g, '');
  const normalizedName = name.replace(/[\s_-]+/g, '');
  const isReceivable =
    normalizedSubType.includes('accountsreceivable') ||
    normalizedName.includes('accountsreceivable') ||
    name.includes('receivable');

  if (isReceivable) return false;

  return (
    Boolean(account.is_bank_account) ||
    (type === 'asset' && !isReceivable) ||
    subType.includes('cash') ||
    name.includes('bank') ||
    name.includes('checking') ||
    name.includes('operating') ||
    name.includes('trust')
  );
};

const isDepositAccount = (account?: BasicAccount | null): boolean => {
  if (!account) return false;
  if (account.exclude_from_cash_balances) return false;
  const type = (account.type || '').toLowerCase();
  const subType = (account.sub_type || '').toLowerCase();
  const cat = (account.gl_account_category?.category || '').toLowerCase();
  const name = (account.name || '').toLowerCase();
  return (
    Boolean(account.is_security_deposit_liability) ||
    (type === 'liability' &&
      (subType.includes('deposit') || cat.includes('deposit') || name.includes('deposit')))
  );
};

const isPrepayAccount = (account?: BasicAccount | null): boolean => {
  if (!account) return false;
  if (account.exclude_from_cash_balances) return false;
  const type = (account.type || '').toLowerCase();
  const subType = (account.sub_type || '').toLowerCase();
  const cat = (account.gl_account_category?.category || '').toLowerCase();
  const name = (account.name || '').toLowerCase();
  const hasPrepayKeyword =
    subType.includes('prepay') ||
    subType.includes('prepaid') ||
    subType.includes('advance') ||
    cat.includes('prepay') ||
    cat.includes('prepaid') ||
    cat.includes('advance') ||
    name.includes('prepay') ||
    name.includes('advance');
  return type === 'liability' && hasPrepayKeyword;
};

export const signedAmountFromTransaction = (tx: BasicTransaction): number => {
  const headerAmounts = [
    tx?.TotalAmount,
    tx?.total_amount,
    tx?.Amount,
    tx?.amount,
  ].map((value) => normalizeNumber(value));
  const firstNonZero = headerAmounts.find((value) => Math.abs(value) > 0);
  const rawAmount = firstNonZero ?? 0;

  const extractLines = (): BasicLine[] => {
    const lines = Array.isArray(tx?.transaction_lines)
      ? tx.transaction_lines
      : Array.isArray(tx?.Lines)
        ? tx.Lines
        : Array.isArray(tx?.Journal?.Lines)
          ? tx.Journal?.Lines
          : [];
    return lines.filter(Boolean);
  };

  const inferAmountFromLines = (): number => {
    const lines = extractLines();
    if (!lines.length) return 0;

    let debitTotal = 0;
    let creditTotal = 0;
    for (const line of lines) {
      const amt = Math.abs(
        normalizeNumber(line?.amount ?? (line as { Amount?: MaybeNumber })?.Amount ?? 0),
      );
      if (!amt) continue;
      const postingRaw =
        line?.posting_type ??
        (line as { PostingType?: string | null })?.PostingType ??
        (line as { LineType?: string | null })?.LineType ??
        (line as { postingType?: string | null })?.postingType ??
        '';
      const posting = String(postingRaw || '').toLowerCase();
      if (posting === 'credit' || posting === 'cr') {
        creditTotal += amt;
      } else if (posting === 'debit' || posting === 'dr') {
        debitTotal += amt;
      } else {
        debitTotal += amt;
      }
    }

    return Math.max(debitTotal, creditTotal);
  };

  const amount = Math.abs(firstNonZero ?? inferAmountFromLines());
  if (!amount) return 0;

  const typeRaw =
    tx?.TransactionTypeEnum ?? tx?.TransactionType ?? tx?.transaction_type ?? tx?.type ?? '';
  const type = String(typeRaw || '').toLowerCase();

  const isPaymentLike =
    type.includes('payment') ||
    type.includes('credit') ||
    type.includes('refund') ||
    type.includes('adjustment') ||
    type.includes('receipt');
  const isChargeLike =
    type.includes('charge') ||
    type.includes('invoice') ||
    type.includes('debit') ||
    type.includes('bill');

  if (isPaymentLike) return -amount;
  if (isChargeLike) return amount;

  // Fallback: preserve sign from raw
  const rawSigned = normalizeNumber(rawAmount);
  return rawSigned || amount;
};

export const signedAmountFromLine = (line: BasicLine): number => {
  const amount = Math.abs(normalizeNumber(line?.amount ?? 0));
  if (!amount) return 0;
  return signedByNormalBalance(amount, line?.posting_type, line?.gl_accounts?.type);
};

export const classifyLine = (line: BasicLine) => {
  const amount = Math.abs(normalizeNumber(line?.amount ?? 0));
  if (!amount) {
    return {
      bankSigned: 0,
      depositSigned: 0,
      prepaySigned: 0,
      arSigned: 0,
      flags: {
        bank: false,
        deposit: false,
        prepay: false,
      },
    };
  }

  const account = line?.gl_accounts || null;
  if (account?.exclude_from_cash_balances) {
    return {
      bankSigned: 0,
      depositSigned: 0,
      prepaySigned: 0,
      arSigned: 0,
      flags: {
        bank: false,
        deposit: false,
        prepay: false,
      },
    };
  }
  const bankFlag = isBankAccount(account);
  const depositFlag = isDepositAccount(account);
  const prepayFlag = isPrepayAccount(account);
  const subType = (account?.sub_type || '').toLowerCase();
  const normalizedSubType = subType.replace(/[\s_-]+/g, '');
  const normalizedName = (account?.name || '').toLowerCase().replace(/[\s_-]+/g, '');
  const arFlag =
    normalizedSubType === 'accountsreceivable' || normalizedName.includes('accountsreceivable');

  const signed = signedByNormalBalance(amount, line?.posting_type, account?.type);
  const liabilitySigned = signedByNormalBalance(amount, line?.posting_type, 'liability');

  return {
    bankSigned: bankFlag ? signed : 0,
    depositSigned: depositFlag ? liabilitySigned : 0,
    prepaySigned: prepayFlag ? liabilitySigned : 0,
    arSigned: arFlag ? signed : 0,
    flags: {
      bank: bankFlag,
      deposit: depositFlag,
      prepay: prepayFlag,
    },
  };
};

const normalizeLiability = (value: MaybeNumber): number => {
  const num = normalizeNumber(value);
  if (!Number.isFinite(num)) return 0;
  return num > 0 ? -num : num;
};

const isPaymentLikeTx = (tx: BasicTransaction): boolean => {
  if (isChargeLikeTx(tx)) return false;
  const typeRaw =
    tx?.transaction_type ?? tx?.TransactionType ?? tx?.TransactionTypeEnum ?? tx?.type ?? '';
  const type = String(typeRaw || '').toLowerCase();
  return (
    type.includes('payment') ||
    type.includes('credit') ||
    type.includes('refund') ||
    type.includes('adjustment') ||
    type.includes('receipt')
  );
};

const isChargeLikeTx = (tx: BasicTransaction): boolean => {
  const typeRaw =
    tx?.transaction_type ?? tx?.TransactionType ?? tx?.TransactionTypeEnum ?? tx?.type ?? '';
  const type = String(typeRaw || '').toLowerCase();
  return (
    type.includes('charge') ||
    type.includes('invoice') ||
    type.includes('debit') ||
    type.includes('bill') ||
    type.includes('fee')
  );
};

export function rollupFinances(params: FinanceRollupParams): FinanceRollupResult {
  let transactionLines = Array.isArray(params.transactionLines) ? params.transactionLines : [];
  const transactions = Array.isArray(params.transactions) ? params.transactions : [];
  const propertyReserve = normalizeNumber(params.propertyReserve ?? 0);
  const txKindById = new Map<string, 'payment' | 'charge'>();

  for (const tx of transactions) {
    const txId = tx?.id != null ? String(tx.id) : '';
    if (!txId) continue;
    if (isPaymentLikeTx(tx)) {
      txKindById.set(txId, 'payment');
    } else if (isChargeLikeTx(tx)) {
      txKindById.set(txId, 'charge');
    }
  }

  // Filter by entity type if provided
  if (params.entityType) {
    transactionLines = transactionLines.filter(
      (line) => line.account_entity_type === params.entityType,
    );
  }

  const baseBalance = normalizeNumber(params.unitBalances?.balance ?? 0);
  const baseDeposits = normalizeNumber(params.unitBalances?.deposits_held_balance ?? 0);
  const basePrepayments = normalizeNumber(params.unitBalances?.prepayments_balance ?? 0);

  let bankTotal = 0;
  let depositTotal = 0;
  let prepayTotal = 0;
  let arFallback = 0;
  let bankLineCount = 0;
  const depositTxIdSet = new Set<string>();
  const prepayTxIdSet = new Set<string>();

  for (const line of transactionLines) {
    const txIdRaw = line?.transaction_id;
    const txId = txIdRaw != null ? String(txIdRaw) : '';
    const txKind = txId ? txKindById.get(txId) : undefined;
    const { bankSigned, depositSigned, prepaySigned, arSigned, flags } = classifyLine(line);
    bankTotal += bankSigned;
    const includeLiability =
      txKind !== 'charge' ||
      // If we do not have a transaction type for the line, keep legacy behavior to avoid losing data
      txKind === undefined;
    if (includeLiability) {
      depositTotal += depositSigned;
      prepayTotal += prepaySigned;
    }
    arFallback += arSigned;
    if (flags.bank) {
      bankLineCount++;
      // #region agent log
      if (bankLineCount <= 5)
        fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'finance/model.ts:268',
            message: 'Bank line classified',
            data: {
              gl_account_id: line.gl_accounts?.name || 'unknown',
              amount: line.amount,
              posting_type: line.posting_type,
              bankSigned,
              flags: flags.bank,
              property_id: line.property_id,
              unit_id: line.unit_id,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'run1',
            hypothesisId: 'B',
          }),
        }).catch(() => {});
      // #endregion
    }
    if (flags.deposit && txId) depositTxIdSet.add(txId);
    if (flags.prepay && txId) prepayTxIdSet.add(txId);
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'finance/model.ts:272',
      message: 'After processing lines',
      data: { bankTotal, bankLineCount, depositTotal, prepayTotal, arFallback },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'B',
    }),
  }).catch(() => {});
  // #endregion

  let cashBalance = baseBalance;
  let depositsHeld = baseDeposits;
  let prepayments = basePrepayments;
  let usedBankBalance = false;
  const usedArFallback = false;

  if (depositTotal) depositsHeld = depositTotal;
  if (prepayTotal) prepayments = prepayTotal;

  // Payment fallback when bank lines are not tied to the unit
  let paymentsTotal = 0;
  let depositsFromPayments = 0;
  let prepaymentsFromPayments = 0;
  type PaymentTxDetail = {
    txId: string;
    amount: number;
    transaction_type?: unknown;
    total_amount?: unknown;
  };
  const paymentTxDetails: PaymentTxDetail[] = [];
  for (const tx of transactions) {
    if (!isPaymentLikeTx(tx)) continue;
    const txId = tx?.id != null ? String(tx.id) : '';
    const amount = Math.abs(
      normalizeNumber(tx?.total_amount ?? tx?.TotalAmount ?? tx?.amount ?? tx?.Amount ?? 0),
    );
    paymentsTotal += amount;
    paymentTxDetails.push({
      txId,
      amount,
      transaction_type: tx.transaction_type,
      total_amount: tx.total_amount,
    });
    if (txId && depositTxIdSet.has(txId)) depositsFromPayments += amount;
    if (txId && prepayTxIdSet.has(txId)) prepaymentsFromPayments += amount;
  }

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'finance/model.ts:295',
      message: 'Payment transactions summary',
      data: {
        paymentsTotal,
        paymentTxDetails: paymentTxDetails.slice(0, 10),
        depositsFromPayments,
        prepaymentsFromPayments,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'E',
    }),
  }).catch(() => {});
  // #endregion

  // Heuristic correction:
  // In some edge cases (notably tenant security deposit payments routed to Undeposited Funds),
  // Buildium/journal ingestion can produce bank lines whose sign matches the deposit liability
  // (e.g., bankTotal = -2500 and depositsHeld = -2500), even though economically the deposit
  // represents cash held, not a cash outflow. When we have bank lines, no reliable payment
  // header amount, and the bank/deposit totals move in lockstep, treat the bank total as
  // positive cash so that cash_balance and available_balance stay consistent.
  if (
    bankLineCount > 0 &&
    !paymentsTotal &&
    depositsHeld < 0 &&
    bankTotal < 0 &&
    Math.abs(Math.abs(bankTotal) - Math.abs(depositsHeld)) < 0.0001
  ) {
    bankTotal = -bankTotal;
  }

  let usedPaymentFallback = false;
  const incompleteBankLines =
    bankLineCount > 0 &&
    Math.abs(paymentsTotal) > 0 &&
    Math.abs(bankTotal) < Math.abs(paymentsTotal) / 10;

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'finance/model.ts:300',
      message: 'Before balance decision',
      data: {
        bankLineCount,
        bankTotal,
        paymentsTotal,
        incompleteBankLines,
        condition1: bankLineCount > 0 && Math.abs(bankTotal) >= Math.abs(paymentsTotal) * 0.1,
        condition2:
          bankLineCount > 0 &&
          paymentsTotal > 0 &&
          Math.abs(paymentsTotal) > Math.abs(bankTotal) * 10,
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'C',
    }),
  }).catch(() => {});
  // #endregion

  // Prefer bank lines when they exist and look complete; otherwise fall back to payments
  if (bankLineCount > 0 && !incompleteBankLines) {
    // Use bankTotal when bank lines look reliable
    cashBalance = bankTotal;
    usedBankBalance = true;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'finance/model.ts:305',
        message: 'Using bankTotal (prioritized)',
        data: { cashBalance: bankTotal },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'C',
      }),
    }).catch(() => {});
    // #endregion
  } else if (paymentsTotal) {
    // Use payments_total when bank lines are missing or clearly incomplete
    cashBalance = paymentsTotal;
    usedPaymentFallback = true;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'finance/model.ts:318',
        message: 'Using paymentsTotal (no bank lines)',
        data: { cashBalance: paymentsTotal },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'C',
      }),
    }).catch(() => {});
    // #endregion
  }
  if (depositsFromPayments) depositsHeld = depositsFromPayments;
  if (prepaymentsFromPayments) prepayments = prepaymentsFromPayments;

  const securityDepositsAndPrepayments =
    normalizeLiability(depositsHeld) + normalizeLiability(prepayments);
  const availableBalance = cashBalance + securityDepositsAndPrepayments - propertyReserve;

  return {
    fin: {
      cash_balance: cashBalance,
      security_deposits: securityDepositsAndPrepayments,
      prepayments,
      reserve: propertyReserve,
      available_balance: availableBalance,
      as_of: (params.today || new Date()).toISOString().slice(0, 10),
    },
    debug: {
      totals: {
        bank: bankTotal,
        deposits: depositsHeld,
        prepayments,
        payments: paymentsTotal,
        depositsFromPayments,
        prepaymentsFromPayments,
        arFallback,
      },
      usedBankBalance,
      usedPaymentFallback,
      usedArFallback,
      incompleteBankLines,
      bankLineCount,
    },
  };
}
