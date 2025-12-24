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

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const firstValue = <T>(...candidates: unknown[]): T | undefined => {
  const hit = candidates.find((value) => value !== undefined && value !== null);
  return hit as T | undefined;
};

export const extractLeaseTransactionFromResponse = (
  payload: unknown,
): LeaseTransactionRecord | null => {
  if (!isRecord(payload)) {
    return null;
  }

  const nestedData = isRecord(payload.data) ? payload.data : undefined;
  const candidate = nestedData?.transaction ?? payload.transaction ?? null;
  if (!isRecord(candidate)) {
    return null;
  }

  const idRaw = firstValue<string | number>(
    candidate.id,
    candidate.transaction_id,
  );
  if (typeof idRaw !== 'string' && typeof idRaw !== 'number') {
    return null;
  }

  const leaseIdRaw = firstValue<string | number>(
    candidate.lease_id,
    candidate.leaseId,
    (candidate as { LeaseId?: unknown }).LeaseId,
  );
  if (typeof leaseIdRaw !== 'string' && typeof leaseIdRaw !== 'number') {
    return null;
  }

  const dateRaw = firstValue<string | Date>(candidate.date, (candidate as { Date?: unknown }).Date);
  if (!dateRaw) {
    return null;
  }

  const transactionTypeRaw = firstValue<string>(
    candidate.transaction_type,
    (candidate as { transactionType?: unknown }).transactionType,
    (candidate as { TransactionType?: unknown }).TransactionType,
  );
  if (!transactionTypeRaw) {
    return null;
  }

  const totalAmountRaw = firstValue<number | string>(
    candidate.total_amount,
    (candidate as { TotalAmount?: unknown }).TotalAmount,
    candidate.amount,
    (candidate as { Amount?: unknown }).Amount,
  );
  const parsedTotal = Number(totalAmountRaw);
  const totalAmount = Number.isFinite(parsedTotal) ? parsedTotal : 0;

  const memoRaw = firstValue<string>(
    candidate.memo,
    (candidate as { Memo?: unknown }).Memo,
  );
  const referenceNumberRaw = firstValue<string | number>(
    candidate.reference_number,
    (candidate as { referenceNumber?: unknown }).referenceNumber,
    (candidate as { ReferenceNumber?: unknown }).ReferenceNumber,
  );

  return {
    id: idRaw,
    transaction_type: String(transactionTypeRaw),
    total_amount: totalAmount,
    date: String(dateRaw),
    memo: memoRaw != null ? String(memoRaw) : null,
    lease_id: leaseIdRaw,
    reference_number: referenceNumberRaw != null ? String(referenceNumberRaw) : null,
  };
};
