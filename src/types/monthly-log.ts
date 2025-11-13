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
