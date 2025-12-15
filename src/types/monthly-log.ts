export interface MonthlyLogTransaction {
  id: string;
  total_amount: number;
  memo: string | null;
  date: string;
  transaction_type: string;
  lease_id: number | null;
  monthly_log_id: string | null;
  reference_number: string | null;
  account_name?: string | null;
}

export interface MonthlyLogFinancialSummary {
  totalCharges: number;
  totalCredits: number;
  totalPayments: number;
  totalBills: number;
  escrowAmount: number;
  managementFees: number;
  netToOwner: number;
  balance: number;
  previousBalance: number;
  ownerDraw?: number;
  chargesTrend?: 'up' | 'down' | 'stable';
  paymentsTrend?: 'up' | 'down' | 'stable';
}

export type NetToOwnerInput = {
  previousBalance: number;
  totalPayments: number;
  totalBills: number;
  escrowAmount: number;
  managementFees: number;
  ownerDraw: number;
};

export const calculateNetToOwnerValue = (input: NetToOwnerInput): number => {
  const { previousBalance, totalPayments, totalBills, escrowAmount, managementFees, ownerDraw } =
    input;
  const signedEscrowAmount = Number(escrowAmount ?? 0);
  return (
    previousBalance +
    totalPayments -
    totalBills -
    managementFees -
    ownerDraw +
    signedEscrowAmount
  );
};

export const normalizeFinancialSummary = (
  raw: Partial<MonthlyLogFinancialSummary> | null | undefined,
): MonthlyLogFinancialSummary => {
  const totalCharges = Number(raw?.totalCharges ?? 0);
  const totalCredits = Number(raw?.totalCredits ?? 0);
  const totalPayments = Number(raw?.totalPayments ?? 0);
  const totalBills = Number(raw?.totalBills ?? 0);
  const escrowAmount = Number(raw?.escrowAmount ?? 0);
  const managementFees = Number(raw?.managementFees ?? 0);
  const previousBalance = Number(raw?.previousBalance ?? 0);

  const ownerDraw =
    typeof raw?.ownerDraw === 'number'
      ? raw.ownerDraw
      : totalPayments - totalBills - escrowAmount;

  const netToOwner = calculateNetToOwnerValue({
    previousBalance,
    totalPayments,
    totalBills,
    escrowAmount,
    managementFees,
    ownerDraw,
  });

  const balance =
    typeof raw?.balance === 'number'
      ? raw.balance
      : totalCharges - totalCredits - totalPayments;

  return {
    totalCharges,
    totalCredits,
    totalPayments,
    totalBills,
    escrowAmount,
    managementFees,
    netToOwner,
    balance,
    previousBalance,
    ownerDraw,
    chargesTrend: raw?.chargesTrend,
    paymentsTrend: raw?.paymentsTrend,
  };
};

export type MonthlyLogApiError = { code?: string; message?: string } | string | null | undefined;

export type MonthlyLogTransactionLike = Partial<MonthlyLogTransaction> & {
  transaction_id?: string | number | null;
  transactionId?: string | number | null;
  TotalAmount?: number | string | null;
  amount?: number | string | null;
  Amount?: number | string | null;
  Date?: string | null;
  transactionType?: string | null;
  referenceNumber?: string | number | null;
  ReferenceNumber?: string | number | null;
  accountName?: string | null;
  AccountName?: string | null;
};

export interface MonthlyLogTransactionResponse {
  data?: {
    transaction?: MonthlyLogTransactionLike | MonthlyLogTransaction | null;
    [key: string]: unknown;
  };
  transaction?: MonthlyLogTransactionLike | MonthlyLogTransaction | null;
  values?: Record<string, unknown>;
  error?: MonthlyLogApiError;
}

export const safeParseJson = <T>(text: string): T | null => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export const getMonthlyLogErrorMessage = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const error = (payload as { error?: MonthlyLogApiError }).error;
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return null;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const normalizeMonthlyLogTransaction = (
  transaction: MonthlyLogTransactionLike | MonthlyLogTransaction | null | undefined,
  defaults: Partial<MonthlyLogTransaction> = {},
): MonthlyLogTransaction | null => {
  const tx: MonthlyLogTransactionLike =
    (transaction as MonthlyLogTransactionLike | null | undefined) ?? {};

  const idCandidate = tx.id ?? tx.transaction_id ?? tx.transactionId ?? defaults.id;
  const id = idCandidate != null ? String(idCandidate) : null;

  const amountCandidate =
    tx.total_amount ?? tx.TotalAmount ?? tx.amount ?? tx.Amount ?? defaults.total_amount ?? 0;
  const totalAmount = toNumberOrNull(amountCandidate) ?? 0;

  const dateCandidate = tx.date ?? tx.Date ?? defaults.date ?? null;
  const date = typeof dateCandidate === 'string' && dateCandidate ? dateCandidate : null;

  const transactionType =
    tx.transaction_type ?? tx.transactionType ?? defaults.transaction_type ?? null;

  const memo = tx.memo ?? defaults.memo ?? null;

  const referenceCandidate =
    tx.reference_number ?? tx.referenceNumber ?? tx.ReferenceNumber ?? defaults.reference_number;
  const reference_number =
    referenceCandidate != null ? String(referenceCandidate) : referenceCandidate ?? null;

  const leaseIdRaw = tx.lease_id ?? defaults.lease_id ?? null;
  const lease_id =
    typeof leaseIdRaw === 'number'
      ? leaseIdRaw
      : toNumberOrNull(leaseIdRaw) ?? null;

  const monthlyLogIdRaw = tx.monthly_log_id ?? defaults.monthly_log_id ?? null;
  const monthly_log_id =
    monthlyLogIdRaw != null ? String(monthlyLogIdRaw) : null;

  const accountNameCandidate =
    tx.account_name ?? tx.accountName ?? tx.AccountName ?? defaults.account_name ?? null;
  const account_name =
    typeof accountNameCandidate === 'string' && accountNameCandidate.length
      ? accountNameCandidate
      : accountNameCandidate ?? null;

  if (!id || !transactionType || !date) {
    return null;
  }

  return {
    id,
    total_amount: totalAmount,
    memo: memo != null ? String(memo) : null,
    date,
    transaction_type: String(transactionType),
    lease_id,
    monthly_log_id,
    reference_number,
    account_name,
  };
};

export const extractTransactionFromResponse = (
  payload: MonthlyLogTransactionResponse | unknown,
  defaults: Partial<MonthlyLogTransaction> = {},
): MonthlyLogTransaction | null => {
  if (!payload || typeof payload !== 'object') {
    return normalizeMonthlyLogTransaction(null, defaults);
  }

  const castPayload = payload as MonthlyLogTransactionResponse;
  const candidate = castPayload.data?.transaction ?? castPayload.transaction;

  return normalizeMonthlyLogTransaction(candidate, defaults);
};
