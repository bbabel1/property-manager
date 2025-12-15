import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import useSWR from 'swr';

import type { MonthlyLogStatus } from '@/components/monthly-logs/types';
import { useMonthlyLogData } from '@/hooks/useMonthlyLogData';
import type { MonthlyLogFinancialSummary, MonthlyLogTransaction } from '@/types/monthly-log';

export type RelatedLogOption = {
  id: string;
  label: string;
  status: MonthlyLogStatus | string;
};

export interface MonthlyLogDetailInitialData {
  assignedTransactions?: MonthlyLogTransaction[];
  financialSummary?: MonthlyLogFinancialSummary | null;
  unassignedTransactions?: MonthlyLogTransaction[];
  unassignedCursor?: string | null;
}

export interface UseMonthlyLogDetailOptions {
  monthlyLogId: string;
  periodStart: string;
  leaseId: number | null;
  unitId: string | null;
  shouldLoadRelatedLogs: boolean;
  loadUnitTransactions?: boolean;
  initialData?: MonthlyLogDetailInitialData;
}

export interface MonthlyLogDetailState {
  relatedLogs: RelatedLogOption[];
  relatedLogsLoading: boolean;
  transactionScope: 'lease' | 'unit';
  setTransactionScope: Dispatch<SetStateAction<'lease' | 'unit'>>;
  loadLeaseUnassigned: boolean;
  loadUnitUnassigned: boolean;
  assignedTransactions: MonthlyLogTransaction[];
  leaseUnassignedTransactions: MonthlyLogTransaction[];
  unitUnassignedTransactions: MonthlyLogTransaction[];
  financialSummary: MonthlyLogFinancialSummary | null;
  loadingAssigned: boolean;
  loadingLeaseUnassigned: boolean;
  loadingUnitUnassigned: boolean;
  loadingFinancial: boolean;
  loadingMoreLeaseUnassigned: boolean;
  loadingMoreUnitUnassigned: boolean;
  hasMoreLeaseUnassigned: boolean;
  hasMoreUnitUnassigned: boolean;
  loadMoreLeaseUnassigned: () => Promise<void>;
  loadMoreUnitUnassigned: () => Promise<void>;
  moveTransactionToAssigned: (transaction: MonthlyLogTransaction) => void;
  moveTransactionToUnassigned: (transactionId: string) => void;
  addAssignedTransaction: (transaction: MonthlyLogTransaction) => void;
  removeAssignedTransaction: (transactionId: string) => void;
  removeUnassignedTransaction: (transactionId: string) => void;
  refetchAssigned: () => Promise<void>;
  refetchFinancial: () => Promise<void>;
}

export function useMonthlyLogDetail({
  monthlyLogId,
  periodStart,
  leaseId,
  unitId,
  shouldLoadRelatedLogs,
  loadUnitTransactions = false,
  initialData,
}: UseMonthlyLogDetailOptions): MonthlyLogDetailState {
  const [transactionScope, setTransactionScope] = useState<'lease' | 'unit'>(
    leaseId ? 'lease' : 'unit',
  );
  const [loadLeaseUnassigned, setLoadLeaseUnassigned] = useState<boolean>(Boolean(leaseId));
  const [loadUnitUnassigned, setLoadUnitUnassigned] = useState<boolean>(
    !leaseId && loadUnitTransactions,
  );

  useEffect(() => {
    if (transactionScope === 'lease' && leaseId && !loadLeaseUnassigned) {
      setLoadLeaseUnassigned(true);
    }
    if (transactionScope === 'unit' && loadUnitTransactions && !loadUnitUnassigned) {
      setLoadUnitUnassigned(true);
    }
  }, [
    leaseId,
    loadLeaseUnassigned,
    loadUnitTransactions,
    loadUnitUnassigned,
    transactionScope,
  ]);

  const { data: relatedLogsResponse, isLoading: relatedLogsLoading } = useSWR<{
    items: RelatedLogOption[];
  }>(
    shouldLoadRelatedLogs && unitId
      ? `/api/monthly-logs/${monthlyLogId}/related?unitId=${unitId}`
      : null,
  );

  const relatedLogs = useMemo(() => relatedLogsResponse?.items ?? [], [relatedLogsResponse]);

  const {
    assignedTransactions,
    unassignedTransactions,
    unitUnassignedTransactions,
    financialSummary,
    loadingAssigned,
    loadingUnassigned,
    loadingUnitUnassigned,
    loadingFinancial,
    loadingMoreUnassigned,
    loadingMoreUnitUnassigned,
    hasMoreUnassigned,
    hasMoreUnitUnassigned,
    moveTransactionToAssigned,
    moveTransactionToUnassigned,
    addAssignedTransaction,
    removeAssignedTransaction,
    removeUnassignedTransaction,
    refetchAssigned,
    refetchFinancial,
    loadMoreUnassigned,
    loadMoreUnitUnassigned,
  } = useMonthlyLogData(monthlyLogId, {
    initialAssigned: initialData?.assignedTransactions,
    initialSummary: initialData?.financialSummary,
    initialUnassigned: initialData?.unassignedTransactions,
    initialUnassignedCursor: initialData?.unassignedCursor ?? null,
    leaseId,
    unitId,
    loadLeaseUnassigned,
    loadUnitUnassigned,
  });

  const leaseUnassignedTransactions = useMemo(() => unassignedTransactions, [unassignedTransactions]);

  return {
    relatedLogs,
    relatedLogsLoading,
    transactionScope,
    setTransactionScope,
    loadLeaseUnassigned,
    loadUnitUnassigned,
    assignedTransactions,
    leaseUnassignedTransactions,
    unitUnassignedTransactions,
    financialSummary,
    loadingAssigned,
    loadingLeaseUnassigned: loadingUnassigned,
    loadingUnitUnassigned,
    loadingFinancial,
    loadingMoreLeaseUnassigned: loadingMoreUnassigned,
    loadingMoreUnitUnassigned,
    hasMoreLeaseUnassigned: hasMoreUnassigned,
    hasMoreUnitUnassigned,
    loadMoreLeaseUnassigned: loadMoreUnassigned,
    loadMoreUnitUnassigned,
    moveTransactionToAssigned,
    moveTransactionToUnassigned,
    addAssignedTransaction,
    removeAssignedTransaction,
    removeUnassignedTransaction,
    refetchAssigned,
    refetchFinancial,
  };
}
