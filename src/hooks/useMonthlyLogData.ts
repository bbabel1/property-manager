'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { toast } from 'sonner';

import {
  normalizeFinancialSummary,
  calculateNetToOwnerValue,
  type MonthlyLogFinancialSummary,
  type MonthlyLogTransaction,
} from '@/types/monthly-log';

type AssignedResponse = {
  transactions: MonthlyLogTransaction[];
  summary: MonthlyLogFinancialSummary | null;
};

type UnassignedPage = {
  items: MonthlyLogTransaction[];
  nextCursor: string | null;
};

interface UseMonthlyLogDataOptions {
  initialAssigned?: MonthlyLogTransaction[];
  initialSummary?: MonthlyLogFinancialSummary | null;
  initialUnassigned?: MonthlyLogTransaction[];
  initialUnassignedCursor?: string | null;
  initialUnitUnassigned?: MonthlyLogTransaction[];
  initialUnitUnassignedCursor?: string | null;
  leaseId?: number | null;
  unitId?: string | null;
  loadLeaseUnassigned?: boolean;
  loadUnitUnassigned?: boolean;
}

interface UseMonthlyLogDataReturn {
  assignedTransactions: MonthlyLogTransaction[];
  unassignedTransactions: MonthlyLogTransaction[];
  unitUnassignedTransactions: MonthlyLogTransaction[];
  financialSummary: MonthlyLogFinancialSummary | null;

  loading: boolean;
  loadingAssigned: boolean;
  loadingUnassigned: boolean;
  loadingUnitUnassigned: boolean;
  loadingFinancial: boolean;
  loadingMoreUnassigned: boolean;
  loadingMoreUnitUnassigned: boolean;
  hasMoreUnassigned: boolean;
  hasMoreUnitUnassigned: boolean;

  error: string | null;

  refetchAssigned: () => Promise<void>;
  refetchUnassigned: () => Promise<void>;
  refetchUnitUnassigned: () => Promise<void>;
  refetchFinancial: () => Promise<void>;
  refetchAll: () => Promise<void>;
  loadMoreUnassigned: () => Promise<void>;
  loadMoreUnitUnassigned: () => Promise<void>;

  addAssignedTransaction: (transaction: MonthlyLogTransaction) => void;
  removeAssignedTransaction: (transactionId: string) => void;
  removeUnassignedTransaction: (transactionId: string) => void;
  moveTransactionToAssigned: (transaction: MonthlyLogTransaction) => void;
  moveTransactionToUnassigned: (transactionId: string) => void;
}

const UNASSIGNED_PAGE_SIZE = 50;
const TAX_ESCROW_KEYWORD = 'tax escrow';
const OWNER_DRAW_KEYWORD = 'owner draw';
const EXCLUDED_BILL_KEYWORDS = ['management fee', 'property tax'];

const buildAssignedFallback = (
  transactions?: MonthlyLogTransaction[],
  summary?: MonthlyLogFinancialSummary | null,
): AssignedResponse | undefined => {
  if (!transactions && !summary) return undefined;
  return {
    transactions: transactions ?? [],
    summary: summary ?? null,
  };
};

const buildUnassignedFallback = (
  transactions?: MonthlyLogTransaction[],
  cursor?: string | null,
): UnassignedPage[] | undefined => {
  if (!transactions) return undefined;
  return [
    {
      items: transactions,
      nextCursor: cursor ?? null,
    },
  ];
};

const deriveTransactionScope = (
  transaction: MonthlyLogTransaction | undefined,
): 'lease' | 'unit' => {
  if (!transaction) return 'lease';
  return transaction.lease_id ? 'lease' : 'unit';
};

const OWNER_DRAW_ACCOUNT_NAME = 'owner draw';

const deriveLocalSummary = (
  transactions: MonthlyLogTransaction[],
  baseSummary?: MonthlyLogFinancialSummary | null,
): MonthlyLogFinancialSummary => {
  let totalCharges = 0;
  let totalCredits = 0;
  let totalPayments = 0;
  let totalBills = 0;
  let escrowAmount = 0;
  const managementFees = 0;
  let ownerDraw = 0;

  const previousBalance = baseSummary?.previousBalance ?? 0;

  transactions.forEach((transaction) => {
    const amount = Math.abs(transaction.total_amount);
    const accountName = transaction.account_name?.trim().toLowerCase() ?? '';
    const isExcludedBill = EXCLUDED_BILL_KEYWORDS.some((keyword) => accountName.includes(keyword));

    switch (transaction.transaction_type) {
      case 'Charge':
        totalCharges += amount;
        break;
      case 'Credit':
        totalCredits += amount;
        break;
      case 'Payment':
        totalPayments += amount;
        break;
      case 'Bill':
        if (!isExcludedBill) {
          totalBills += amount;
        }
        break;
      default:
        break;
    }

    if (accountName.includes(OWNER_DRAW_KEYWORD)) {
      ownerDraw += amount;
    }

    if (accountName.includes(TAX_ESCROW_KEYWORD)) {
      escrowAmount += amount;
    }
  });

  const netToOwner = calculateNetToOwnerValue({
    previousBalance,
    totalPayments,
    totalBills,
    escrowAmount,
    managementFees,
    ownerDraw,
  });
  const balance = totalCharges - totalCredits - totalPayments;

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
  };
};

const mergeSummaryWithTransactions = (
  transactions: MonthlyLogTransaction[],
  baseSummary: MonthlyLogFinancialSummary | null,
): MonthlyLogFinancialSummary =>
  normalizeFinancialSummary({
    ...(baseSummary ?? {}),
    ...deriveLocalSummary(transactions, baseSummary),
  });

const applyAssignedUpdate = (
  current: AssignedResponse | undefined,
  updater: (transactions: MonthlyLogTransaction[]) => MonthlyLogTransaction[],
): AssignedResponse => {
  const nextTransactions = updater(current?.transactions ?? []);
  const summary = mergeSummaryWithTransactions(nextTransactions, current?.summary ?? null);
  return {
    transactions: nextTransactions,
    summary,
  };
};

export function useMonthlyLogData(
  monthlyLogId: string,
  options: UseMonthlyLogDataOptions = {},
): UseMonthlyLogDataReturn {
  const assignedFallback = useMemo(
    () => buildAssignedFallback(options.initialAssigned, options.initialSummary),
    [options.initialAssigned, options.initialSummary],
  );

  const {
    data: assignedData,
    error: assignedError,
    isLoading: loadingAssigned,
    mutate: mutateAssigned,
  } = useSWR<AssignedResponse>(
    monthlyLogId ? `/api/monthly-logs/${monthlyLogId}/transactions` : null,
    undefined,
    {
      fallbackData: assignedFallback,
      revalidateOnFocus: false,
    },
  );

  const leaseUnassignedFallback = useMemo(
    () => buildUnassignedFallback(options.initialUnassigned, options.initialUnassignedCursor),
    [options.initialUnassigned, options.initialUnassignedCursor],
  );

  const unitUnassignedFallback = useMemo(
    () =>
      buildUnassignedFallback(options.initialUnitUnassigned, options.initialUnitUnassignedCursor),
    [options.initialUnitUnassigned, options.initialUnitUnassignedCursor],
  );

  const shouldLoadLeaseUnassigned =
    Boolean(options.leaseId) && options.loadLeaseUnassigned !== false;
  const shouldLoadUnitUnassigned = Boolean(options.unitId) && options.loadUnitUnassigned !== false;

  const {
    data: unassignedPages,
    error: unassignedError,
    isLoading: loadingUnassigned,
    mutate: mutateUnassigned,
    size,
    setSize,
  } = useSWRInfinite<UnassignedPage>(
    (pageIndex, previousPageData) => {
      if (!shouldLoadLeaseUnassigned) return null;
      if (pageIndex > 0 && previousPageData && !previousPageData.nextCursor) return null;

      const params = new URLSearchParams({
        monthlyLogId,
        limit: String(UNASSIGNED_PAGE_SIZE),
        scope: 'lease',
      });

      if (options.leaseId) {
        params.set('leaseId', String(options.leaseId));
      }

      if (pageIndex > 0 && previousPageData?.nextCursor) {
        params.set('cursor', previousPageData.nextCursor);
      }

      return `/api/transactions/unassigned?${params.toString()}`;
    },
    undefined,
    {
      fallbackData: shouldLoadLeaseUnassigned ? leaseUnassignedFallback : undefined,
      revalidateFirstPage: false,
      revalidateOnFocus: false,
    },
  );

  const {
    data: unitUnassignedPages,
    error: unitUnassignedError,
    isLoading: loadingUnitUnassigned,
    mutate: mutateUnitUnassigned,
    size: unitSize,
    setSize: setUnitSize,
  } = useSWRInfinite<UnassignedPage>(
    (pageIndex, previousPageData) => {
      if (!shouldLoadUnitUnassigned) return null;
      if (pageIndex > 0 && previousPageData && !previousPageData.nextCursor) return null;

      const params = new URLSearchParams({
        monthlyLogId,
        limit: String(UNASSIGNED_PAGE_SIZE),
        scope: 'unit',
      });

      if (options.unitId) {
        params.set('unitId', options.unitId);
      }

      if (pageIndex > 0 && previousPageData?.nextCursor) {
        params.set('cursor', previousPageData.nextCursor);
      }

      return `/api/transactions/unassigned?${params.toString()}`;
    },
    undefined,
    {
      fallbackData: shouldLoadUnitUnassigned ? unitUnassignedFallback : undefined,
      revalidateFirstPage: false,
      revalidateOnFocus: false,
    },
  );

  const [loadingMoreUnassigned, setLoadingMoreUnassigned] = useState(false);
  const [loadingMoreUnitUnassigned, setLoadingMoreUnitUnassigned] = useState(false);

  const assignedTransactions = assignedData?.transactions ?? [];
  const financialSummary = assignedData?.summary
    ? normalizeFinancialSummary(assignedData.summary)
    : null;

  const flattenedUnassigned = useMemo(() => {
    if (!shouldLoadLeaseUnassigned) return [];
    const pages = unassignedPages ?? (leaseUnassignedFallback ? leaseUnassignedFallback : []);
    return pages.flatMap((page) => page.items);
  }, [shouldLoadLeaseUnassigned, unassignedPages, leaseUnassignedFallback]);

  const flattenedUnitUnassigned = useMemo(() => {
    if (!shouldLoadUnitUnassigned) return [];
    const pages = unitUnassignedPages ?? (unitUnassignedFallback ? unitUnassignedFallback : []);
    return pages.flatMap((page) => page.items);
  }, [shouldLoadUnitUnassigned, unitUnassignedPages, unitUnassignedFallback]);

  const hasMoreUnassigned =
    shouldLoadLeaseUnassigned &&
    Boolean((unassignedPages ?? leaseUnassignedFallback)?.at(-1)?.nextCursor);

  const hasMoreUnitUnassigned =
    shouldLoadUnitUnassigned &&
    Boolean((unitUnassignedPages ?? unitUnassignedFallback)?.at(-1)?.nextCursor);

  const loadMoreUnassigned = useCallback(async () => {
    if (!hasMoreUnassigned) return;
    setLoadingMoreUnassigned(true);
    try {
      await setSize((current) => current + 1);
    } finally {
      setLoadingMoreUnassigned(false);
    }
  }, [hasMoreUnassigned, setSize]);

  const loadMoreUnitUnassigned = useCallback(async () => {
    if (!hasMoreUnitUnassigned) return;
    setLoadingMoreUnitUnassigned(true);
    try {
      await setUnitSize((current) => current + 1);
    } finally {
      setLoadingMoreUnitUnassigned(false);
    }
  }, [hasMoreUnitUnassigned, setUnitSize]);

  useEffect(() => {
    if (assignedError) {
      console.error('Failed to load assigned transactions', assignedError);
      toast.error('Failed to load assigned transactions');
    }
  }, [assignedError]);

  useEffect(() => {
    if (unassignedError) {
      console.error('Failed to load unassigned transactions', unassignedError);
      toast.error('Failed to load unassigned transactions');
    }
  }, [unassignedError]);

  useEffect(() => {
    if (unitUnassignedError) {
      console.error('Failed to load unit unassigned transactions', unitUnassignedError);
      toast.error('Failed to load unit transactions');
    }
  }, [unitUnassignedError]);

  const addAssignedTransaction = useCallback(
    (transaction: MonthlyLogTransaction) => {
      mutateAssigned(
        (current) => applyAssignedUpdate(current, (transactions) => [...transactions, transaction]),
        { revalidate: false },
      );
    },
    [mutateAssigned],
  );

  const removeAssignedTransaction = useCallback(
    (transactionId: string) => {
      mutateAssigned(
        (current) =>
          applyAssignedUpdate(current, (transactions) =>
            transactions.filter((tx) => tx.id !== transactionId),
          ),
        { revalidate: false },
      );
    },
    [mutateAssigned],
  );

  const removeUnassignedTransaction = useCallback(
    (transactionId: string) => {
      const removeFromPages = (
        pages: UnassignedPage[] | undefined,
      ): UnassignedPage[] | undefined => {
        if (!pages) return pages;
        return pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.id !== transactionId),
        }));
      };

      mutateUnassigned((pages) => removeFromPages(pages), { revalidate: false });
      mutateUnitUnassigned((pages) => removeFromPages(pages), { revalidate: false });
    },
    [mutateUnassigned, mutateUnitUnassigned],
  );

  const moveTransactionToAssigned = useCallback(
    (transaction: MonthlyLogTransaction) => {
      const removeFromPages = (
        pages: UnassignedPage[] | undefined,
      ): UnassignedPage[] | undefined => {
        if (!pages) return pages;
        return pages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.id !== transaction.id),
        }));
      };

      mutateUnassigned((pages) => removeFromPages(pages), { revalidate: false });

      mutateUnitUnassigned((pages) => removeFromPages(pages), { revalidate: false });

      mutateAssigned(
        (current) => {
          if (current?.transactions?.some((tx) => tx.id === transaction.id)) {
            return current;
          }
          return applyAssignedUpdate(current, (transactions) => [...transactions, transaction]);
        },
        { revalidate: false },
      );
    },
    [mutateAssigned, mutateUnassigned],
  );

  const moveTransactionToUnassigned = useCallback(
    (transactionId: string) => {
      const transaction = assignedTransactions.find((tx) => tx.id === transactionId);
      mutateAssigned(
        (current) =>
          applyAssignedUpdate(current, (transactions) =>
            transactions.filter((tx) => tx.id !== transactionId),
          ),
        { revalidate: false },
      );

      if (transaction) {
        const scope = deriveTransactionScope(transaction);
        const prependTransaction = (pages: UnassignedPage[] | undefined) => {
          if (!pages || !pages.length) {
            return [
              {
                items: [transaction],
                nextCursor: null,
              },
            ];
          }
          const [first, ...rest] = pages;
          return [
            {
              ...first,
              items: [transaction, ...first.items],
            },
            ...rest,
          ];
        };

        if (scope === 'lease') {
          mutateUnassigned((pages) => prependTransaction(pages), { revalidate: false });
        } else {
          mutateUnitUnassigned((pages) => prependTransaction(pages), { revalidate: false });
        }
      }
    },
    [assignedTransactions, mutateAssigned, mutateUnassigned, mutateUnitUnassigned],
  );

  const refetchAssigned = useCallback(async () => {
    await mutateAssigned();
  }, [mutateAssigned]);

  const refetchUnassigned = useCallback(async () => {
    await mutateUnassigned();
  }, [mutateUnassigned]);

  const refetchUnitUnassigned = useCallback(async () => {
    await mutateUnitUnassigned();
  }, [mutateUnitUnassigned]);

  const refetchFinancial = useCallback(async () => {
    await mutateAssigned();
  }, [mutateAssigned]);

  const refetchAll = useCallback(async () => {
    await Promise.all([mutateAssigned(), mutateUnassigned(), mutateUnitUnassigned()]);
  }, [mutateAssigned, mutateUnassigned, mutateUnitUnassigned]);

  const error =
    assignedError?.message ?? unassignedError?.message ?? unitUnassignedError?.message ?? null;
  const loadingFinancial = loadingAssigned;
  const loading = loadingAssigned || loadingUnassigned || loadingUnitUnassigned;

  return {
    assignedTransactions,
    unassignedTransactions: flattenedUnassigned,
    unitUnassignedTransactions: flattenedUnitUnassigned,
    financialSummary,
    loading,
    loadingAssigned,
    loadingUnassigned,
    loadingUnitUnassigned,
    loadingFinancial,
    loadingMoreUnassigned,
    loadingMoreUnitUnassigned,
    hasMoreUnassigned,
    hasMoreUnitUnassigned,
    error,
    refetchAssigned,
    refetchUnassigned,
    refetchUnitUnassigned,
    refetchFinancial,
    refetchAll,
    loadMoreUnassigned,
    loadMoreUnitUnassigned,
    addAssignedTransaction,
    removeAssignedTransaction,
    removeUnassignedTransaction,
    moveTransactionToAssigned,
    moveTransactionToUnassigned,
  };
}

export type Transaction = MonthlyLogTransaction;
export type FinancialSummary = MonthlyLogFinancialSummary;
