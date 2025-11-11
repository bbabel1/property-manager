export type LeaseAccountOption = {
  id: string;
  name: string;
  type?: string | null;
  buildiumGlAccountId?: number | null;
};

export type LeaseTenantOption = {
  id: string;
  name: string;
  buildiumTenantId?: number | null;
};

export const getTenantOptionValue = (option: LeaseTenantOption): string => {
  if (option.buildiumTenantId != null && Number.isFinite(option.buildiumTenantId)) {
    return String(option.buildiumTenantId);
  }
  return option.id;
};

export type LeaseTransactionRecord = {
  id: string | number;
  transaction_type: string;
  total_amount: number;
  date: string;
  memo: string | null;
  lease_id: number | string;
  reference_number?: string | null;
};

export type LeaseFormSuccessPayload = {
  transaction?: LeaseTransactionRecord | null;
};

export const extractLeaseTransactionFromResponse = (
  payload: unknown,
): LeaseTransactionRecord | null => {
  if (!payload || typeof payload !== 'object' || payload === null) {
    return null;
  }

  const candidate =
    (payload as any)?.data?.transaction ?? (payload as any)?.transaction ?? null;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }

  const id = (candidate as any).id ?? (candidate as any).transaction_id ?? null;
  const leaseId =
    (candidate as any).lease_id ??
    (candidate as any).leaseId ??
    (candidate as any).LeaseId ??
    null;
  const date = (candidate as any).date ?? (candidate as any).Date ?? null;
  const transactionType =
    (candidate as any).transaction_type ??
    (candidate as any).transactionType ??
    (candidate as any).TransactionType ??
    null;

  if (id == null || leaseId == null || !date || !transactionType) {
    return null;
  }

  const totalAmountRaw =
    (candidate as any).total_amount ??
    (candidate as any).TotalAmount ??
    (candidate as any).amount ??
    (candidate as any).Amount ??
    0;
  const parsedTotal = Number(totalAmountRaw);
  const totalAmount = Number.isFinite(parsedTotal) ? parsedTotal : 0;

  const memo =
    (candidate as any).memo ?? (candidate as any).Memo ?? null;
  const referenceNumber =
    (candidate as any).reference_number ??
    (candidate as any).referenceNumber ??
    (candidate as any).ReferenceNumber ??
    null;

  return {
    id,
    transaction_type: String(transactionType),
    total_amount: totalAmount,
    date: String(date),
    memo: memo != null ? String(memo) : null,
    lease_id: leaseId,
    reference_number: referenceNumber != null ? String(referenceNumber) : null,
  };
};
