'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClipboardList, Clock, Search, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/ui/utils';
import EnhancedFinancialSummaryCard from '@/components/monthly-logs/EnhancedFinancialSummaryCard';
import EnhancedHeader from '@/components/monthly-logs/EnhancedHeader';
import StatementsStage from '@/components/monthly-logs/StatementsStage';
import TransactionDetailDialog from '@/components/monthly-logs/TransactionDetailDialog';
import JournalEntryDetailDialog from '@/components/monthly-logs/JournalEntryDetailDialog';
import type { MonthlyLogStatus, MonthlyLogTaskSummary } from '@/components/monthly-logs/types';
import { useMonthlyLogData } from '@/hooks/useMonthlyLogData';
import MonthlyLogTransactionOverlay, {
  type TransactionMode,
} from '@/components/monthly-logs/MonthlyLogTransactionOverlay';
import type { LeaseTenantOption } from '@/components/leases/types';
import type { MonthlyLogFinancialSummary, MonthlyLogTransaction } from '@/types/monthly-log';

const LEASE_TRANSACTION_LABELS: Record<string, string> = {
  Charge: 'Lease Charge',
  Payment: 'Lease Payment',
  Credit: 'Lease Credit',
};

const getLeaseTransactionLabel = (type: string): string => LEASE_TRANSACTION_LABELS[type] ?? type;

const buildLeaseTransactionLink = (leaseId?: number | string | null): string | null => {
  if (leaseId == null) return null;
  return `/leases/${leaseId}?tab=financials`;
};

type RelatedLogOption = {
  id: string;
  label: string;
  status: MonthlyLogStatus | string;
};

type Transaction = MonthlyLogTransaction;

const LEASE_TRANSACTION_MODES: TransactionMode[] = [
  'payment',
  'charge',
  'credit',
  'refund',
  'deposit',
];

const UNIT_TRANSACTION_MODES: TransactionMode[] = ['bill', 'propertyTaxEscrow'];

interface MonthlyLogDetailPageContentProps {
  monthlyLog: {
    id: string;
    period_start: string;
    stage: string;
    status: MonthlyLogStatus;
    notes: string | null;
    property_id: string | null;
    unit_id: string | null;
    tenant_id: string | null;
    org_id: string | null;
    properties: {
      id: string;
      name: string | null;
    } | null;
    units: {
      id: string;
      unit_number: string | null;
      unit_name: string | null;
      service_plan: string | null;
      active_services: string[];
      fee_dollar_amount: number | null;
    } | null;
    tenants: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      company_name: string | null;
    } | null;
    activeLease: {
      id: number;
      lease_from_date: string;
      lease_to_date: string | null;
      rent_amount: number | null;
      tenant_names: string[];
      total_charges: number;
    } | null;
  };
  tasks: MonthlyLogTaskSummary[];
  tenantOptions: LeaseTenantOption[];
  initialData?: {
    assignedTransactions: MonthlyLogTransaction[];
    financialSummary: MonthlyLogFinancialSummary | null;
    unassignedTransactions: MonthlyLogTransaction[];
    unassignedCursor: string | null;
  };
}

type TransactionTypeFilter = 'all' | Transaction['transaction_type'];

const TASK_STATUS_BADGE: Record<MonthlyLogTaskSummary['statusKey'], string> = {
  new: 'bg-amber-50 text-amber-700 border border-amber-200',
  in_progress: 'bg-blue-50 text-blue-700 border border-blue-200',
  completed:
    'bg-[var(--color-action-50)] text-[var(--color-action-700)] border border-[var(--color-action-200)]',
  on_hold: 'bg-slate-100 text-slate-700 border border-slate-200',
  cancelled: 'bg-slate-100 text-slate-500 border border-slate-200',
};

const TASK_PRIORITY_DOT: Record<MonthlyLogTaskSummary['priorityKey'], string> = {
  low: 'bg-slate-400',
  normal: 'bg-amber-400',
  high: 'bg-orange-500',
  urgent: 'bg-rose-600',
};

export default function MonthlyLogDetailPageContent({
  monthlyLog,
  tasks,
  tenantOptions,
  initialData,
}: MonthlyLogDetailPageContentProps) {
  const router = useRouter();
  const [logStatus, setLogStatus] = useState<MonthlyLogStatus>(monthlyLog.status);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [unassignedTypeFilter, setUnassignedTypeFilter] = useState<TransactionTypeFilter>('all');
  const [unassignedSearch, setUnassignedSearch] = useState('');
  const [selectedAssigned, setSelectedAssigned] = useState<Set<string>>(new Set());
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());
  const shouldLoadRelatedLogs = Boolean(monthlyLog.unit_id);
  const { data: relatedLogsResponse, isLoading: relatedLogsLoading } = useSWR<{
    items: RelatedLogOption[];
  }>(
    shouldLoadRelatedLogs && monthlyLog.unit_id
      ? `/api/monthly-logs/${monthlyLog.id}/related?unitId=${monthlyLog.unit_id}`
      : null,
  );
  const relatedLogs = relatedLogsResponse?.items ?? [];

  const hasActiveLease = Boolean(monthlyLog.activeLease?.id);
  const {
    assignedTransactions,
    unassignedTransactions: leaseUnassignedTransactions,
    unitUnassignedTransactions,
    financialSummary,
    loadingAssigned,
    loadingUnassigned: loadingLeaseUnassigned,
    loadingUnitUnassigned,
    loadingFinancial,
    loadingMoreUnassigned: loadingMoreLeaseUnassigned,
    loadingMoreUnitUnassigned,
    hasMoreUnassigned: hasMoreLeaseUnassigned,
    hasMoreUnitUnassigned,
    moveTransactionToAssigned,
    moveTransactionToUnassigned,
    addAssignedTransaction,
    removeAssignedTransaction,
    refetchAssigned,
    refetchFinancial,
    loadMoreUnassigned: loadMoreLeaseUnassigned,
    loadMoreUnitUnassigned,
  } = useMonthlyLogData(monthlyLog.id, {
    initialAssigned: initialData?.assignedTransactions,
    initialSummary: initialData?.financialSummary,
    initialUnassigned: initialData?.unassignedTransactions,
    initialUnassignedCursor: initialData?.unassignedCursor ?? null,
    leaseId: monthlyLog.activeLease?.id ?? null,
    unitId: monthlyLog.unit_id ?? null,
  });
  const defaultTransactionMode: TransactionMode = hasActiveLease ? 'payment' : 'bill';
  const [transactionMode, setTransactionMode] = useState<TransactionMode>(defaultTransactionMode);
  const defaultTransactionScope: 'lease' | 'unit' = hasActiveLease ? 'lease' : 'unit';
  const [transactionScope, setTransactionScope] = useState<'lease' | 'unit'>(
    defaultTransactionScope,
  );
  const [transactionOverlayOpen, setTransactionOverlayOpen] = useState(false);
  const [selectedTransactionDetail, setSelectedTransactionDetail] =
    useState<MonthlyLogTransaction | null>(null);
  const [transactionDetailDialogOpen, setTransactionDetailDialogOpen] = useState(false);
  const allowedModes =
    transactionScope === 'lease' ? LEASE_TRANSACTION_MODES : UNIT_TRANSACTION_MODES;
  const propertyId =
    monthlyLog.property_id != null
      ? String(monthlyLog.property_id)
      : monthlyLog.properties?.id != null
        ? String(monthlyLog.properties.id)
        : null;
  const propertyName = monthlyLog.properties?.name ?? null;
  const unitId =
    monthlyLog.unit_id != null
      ? String(monthlyLog.unit_id)
      : monthlyLog.units?.id != null
        ? String(monthlyLog.units.id)
        : null;
  const unitLabel = monthlyLog.units?.unit_number ?? monthlyLog.units?.unit_name ?? null;
  const orgId = monthlyLog.org_id != null ? String(monthlyLog.org_id) : null;

  useEffect(() => {
    if (!allowedModes.includes(transactionMode)) {
      setTransactionMode(allowedModes[0]);
    }
  }, [allowedModes, transactionMode]);

  const formatCurrency = useCallback((value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  }, []);

  const formatDate = useCallback((value: string) => {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const filterUnassignedTransactions = useCallback(
    (transactions: MonthlyLogTransaction[]) => {
      if (!transactions.length) return [];
      const search = unassignedSearch.trim().toLowerCase();
      return transactions.filter((transaction) => {
        if (
          unassignedTypeFilter !== 'all' &&
          transaction.transaction_type !== unassignedTypeFilter
        ) {
          return false;
        }

        if (!search) return true;

        const fields = [
          transaction.memo,
          transaction.reference_number,
          transaction.transaction_type,
        ]
          .filter((field): field is string => Boolean(field))
          .map((field) => field.toLowerCase());

        return fields.some((field) => field.includes(search));
      });
    },
    [unassignedSearch, unassignedTypeFilter],
  );

  const filteredLeaseUnassigned = useMemo(
    () => filterUnassignedTransactions(leaseUnassignedTransactions),
    [filterUnassignedTransactions, leaseUnassignedTransactions],
  );

  const filteredUnitUnassigned = useMemo(
    () => filterUnassignedTransactions(unitUnassignedTransactions),
    [filterUnassignedTransactions, unitUnassignedTransactions],
  );

  const filteredUnassigned = useMemo(
    () => (transactionScope === 'lease' ? filteredLeaseUnassigned : filteredUnitUnassigned),
    [transactionScope, filteredLeaseUnassigned, filteredUnitUnassigned],
  );

  const activeUnassignedRaw =
    transactionScope === 'lease' ? leaseUnassignedTransactions : unitUnassignedTransactions;

  const activeLoadingUnassigned =
    transactionScope === 'lease' ? loadingLeaseUnassigned : loadingUnitUnassigned;
  const activeLoadingMoreUnassigned =
    transactionScope === 'lease' ? loadingMoreLeaseUnassigned : loadingMoreUnitUnassigned;
  const activeHasMoreUnassigned =
    transactionScope === 'lease' ? hasMoreLeaseUnassigned : hasMoreUnitUnassigned;
  const activeLoadMoreUnassigned =
    transactionScope === 'lease' ? loadMoreLeaseUnassigned : loadMoreUnitUnassigned;

  const leaseAssignedTransactions = useMemo(() => {
    if (!monthlyLog.activeLease?.id) return assignedTransactions;
    return assignedTransactions.filter(
      (transaction) => transaction.lease_id === monthlyLog.activeLease?.id,
    );
  }, [assignedTransactions, monthlyLog.activeLease?.id]);

  const unitAssignedTransactions = useMemo(
    () => assignedTransactions.filter((transaction) => !transaction.lease_id),
    [assignedTransactions],
  );

  const visibleAssignedTransactions =
    transactionScope === 'lease' ? leaseAssignedTransactions : unitAssignedTransactions;

  useEffect(() => {
    setSelectedAssigned(new Set());
    setSelectedUnassigned(new Set());
  }, [transactionScope]);

  const handleAssignTransaction = useCallback(
    async (transactionId: string) => {
      const transactionToAssign = filteredUnassigned.find(
        (transaction) => transaction.id === transactionId,
      );
      if (!transactionToAssign) {
        toast.error('Transaction not found');
        return;
      }

      moveTransactionToAssigned(transactionToAssign);

      try {
        const response = await fetch(`/api/monthly-logs/${monthlyLog.id}/transactions/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transactionIds: [transactionId] }),
        });

        if (!response.ok) {
          moveTransactionToUnassigned(transactionId);
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || 'Failed to assign transaction');
        }

        setSelectedUnassigned((prev) => {
          if (!prev.has(transactionId)) return prev;
          const next = new Set(prev);
          next.delete(transactionId);
          return next;
        });
        toast.success('Transaction assigned');
      } catch (error) {
        console.error('Error assigning transaction', error);
        toast.error(error instanceof Error ? error.message : 'Failed to assign transaction');
      }
    },
    [monthlyLog.id, moveTransactionToAssigned, moveTransactionToUnassigned, filteredUnassigned],
  );

  const handleRelatedLogSelect = useCallback(
    (logId: string) => {
      if (!logId || logId === monthlyLog.id) return;
      router.push(`/monthly-logs/${logId}`);
    },
    [monthlyLog.id, router],
  );

  const handleUnassignTransaction = useCallback(
    async (transactionId: string) => {
      const transactionToUnassign = assignedTransactions.find(
        (transaction) => transaction.id === transactionId,
      );
      if (!transactionToUnassign) {
        toast.error('Transaction not found');
        return;
      }

      moveTransactionToUnassigned(transactionId);

      try {
        const response = await fetch(
          `/api/monthly-logs/${monthlyLog.id}/transactions/${transactionId}/unassign`,
          {
            method: 'DELETE',
          },
        );

        if (!response.ok) {
          moveTransactionToAssigned(transactionToUnassign);
          throw new Error('Failed to unassign transaction');
        }

        toast.success('Transaction unassigned');
      } catch (error) {
        console.error('Error unassigning transaction', error);
        toast.error('Failed to unassign transaction');
      }
    },
    [assignedTransactions, monthlyLog.id, moveTransactionToAssigned, moveTransactionToUnassigned],
  );

  const handleBulkUnassign = useCallback(async () => {
    if (selectedAssigned.size === 0) return;

    const ids = Array.from(selectedAssigned);
    const transactionsToUnassign = assignedTransactions.filter((transaction) =>
      ids.includes(transaction.id),
    );

    transactionsToUnassign.forEach((transaction) => moveTransactionToUnassigned(transaction.id));

    try {
      await Promise.all(
        ids.map((transactionId) =>
          fetch(`/api/monthly-logs/${monthlyLog.id}/transactions/${transactionId}/unassign`, {
            method: 'DELETE',
          }),
        ),
      );
      toast.success(`Unassigned ${ids.length} transaction${ids.length === 1 ? '' : 's'}`);
      setSelectedAssigned(new Set());
    } catch (error) {
      transactionsToUnassign.forEach((transaction) => moveTransactionToAssigned(transaction));
      console.error('Error bulk unassigning transactions', error);
      toast.error('Failed to unassign selected transactions');
    }
  }, [
    assignedTransactions,
    monthlyLog.id,
    moveTransactionToAssigned,
    moveTransactionToUnassigned,
    selectedAssigned,
  ]);

  const handleBulkAssign = useCallback(async () => {
    if (selectedUnassigned.size === 0) return;

    const ids = Array.from(selectedUnassigned);
    const transactionsToAssign = activeUnassignedRaw.filter((transaction) =>
      ids.includes(transaction.id),
    );

    transactionsToAssign.forEach((transaction) => moveTransactionToAssigned(transaction));

    let reverted = false;
    const revertAssignments = () => {
      if (reverted) return;
      transactionsToAssign.forEach((transaction) => moveTransactionToUnassigned(transaction.id));
      reverted = true;
    };

    try {
      const response = await fetch(`/api/monthly-logs/${monthlyLog.id}/transactions/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: ids }),
      });

      if (!response.ok) {
        revertAssignments();
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to assign transactions');
      }

      toast.success(`Assigned ${ids.length} transaction${ids.length === 1 ? '' : 's'}`);
      setSelectedUnassigned(new Set());
    } catch (error) {
      revertAssignments();
      console.error('Error bulk assigning transactions', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to assign selected transactions',
      );
    }
  }, [
    monthlyLog.id,
    moveTransactionToAssigned,
    moveTransactionToUnassigned,
    selectedUnassigned,
    activeUnassignedRaw,
  ]);

  const handleStatusToggle = useCallback(async () => {
    const nextStatus: MonthlyLogStatus = logStatus === 'complete' ? 'in_progress' : 'complete';
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/monthly-logs/${monthlyLog.id}/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to update status');
      }

      setLogStatus(nextStatus);
      toast.success(
        nextStatus === 'complete' ? 'Monthly log marked complete' : 'Monthly log reopened',
      );
    } catch (error) {
      console.error('Failed to update monthly log status', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update monthly log status');
    } finally {
      setUpdatingStatus(false);
    }
  }, [logStatus, monthlyLog.id]);

  const handleJournalEntrySaved = useCallback(() => {
    void refetchAssigned();
    void refetchFinancial();
  }, [refetchAssigned, refetchFinancial]);

  const unitName = monthlyLog.units?.unit_name || monthlyLog.units?.unit_number || 'Unit';
  const propertyDisplayName = propertyName ?? 'Property';
  const unitDisplayName = `${propertyDisplayName} • ${unitName}`;

  const tenantName = monthlyLog.tenants
    ? monthlyLog.tenants.company_name
      ? monthlyLog.tenants.company_name
      : [monthlyLog.tenants.first_name, monthlyLog.tenants.last_name].filter(Boolean).join(' ')
    : null;

  const leaseSummaryDetails = useMemo(
    () => ({
      propertyUnit: unitDisplayName,
      tenants: tenantName,
    }),
    [tenantName, unitDisplayName],
  );

  const periodStart = new Date(monthlyLog.period_start);
  const periodDisplay = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  type ManagementDetail = { label: string; value: string };
  const managementDetails: ManagementDetail[] = [
    monthlyLog.units?.service_plan
      ? { label: 'Service plan', value: monthlyLog.units.service_plan }
      : null,
    monthlyLog.units?.active_services?.length
      ? {
          label: 'Active services',
          value: monthlyLog.units.active_services.join(', '),
        }
      : null,
    monthlyLog.units?.fee_dollar_amount != null
      ? {
          label: 'Management fee',
          value: formatCurrency(Math.abs(monthlyLog.units.fee_dollar_amount)),
        }
      : null,
  ].filter((entry): entry is ManagementDetail => Boolean(entry));
  const managementSummaryText =
    managementDetails.length > 0
      ? managementDetails.map((item) => `${item.label}: ${item.value}`).join(' • ')
      : 'No management services configured';

  const activeLease = monthlyLog.activeLease;
  const leaseSummaryParts = activeLease
    ? [
        `Lease: ${formatDate(activeLease.lease_from_date)} – ${activeLease.lease_to_date ? formatDate(activeLease.lease_to_date) : 'Open-ended'}`,
        activeLease.rent_amount != null ? `Rent: ${formatCurrency(activeLease.rent_amount)}` : null,
        activeLease.tenant_names.length ? `Tenants: ${activeLease.tenant_names.join(', ')}` : null,
        `Charges: ${formatCurrency(activeLease.total_charges)}`,
      ].filter(Boolean)
    : [];

  const statusActionLabel =
    logStatus === 'complete' ? 'Reopen monthly log' : 'Mark monthly log complete';

  const supportsUnitTransactions = Boolean(monthlyLog.unit_id);
  const addTransactionDisabled =
    transactionScope === 'lease' ? !hasActiveLease : !supportsUnitTransactions;
  const addTransactionDisabledReason = addTransactionDisabled
    ? transactionScope === 'lease'
      ? 'Link an active lease to this monthly log to add lease transactions.'
      : 'Unit information is required before adding unit transactions.'
    : null;

  const assignedSelectedCount = selectedAssigned.size;
  const unassignedSelectedCount = selectedUnassigned.size;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        size="sm"
        variant={logStatus === 'complete' ? 'outline' : 'default'}
        className="gap-2"
        onClick={handleStatusToggle}
        disabled={updatingStatus}
      >
        {updatingStatus ? 'Updating…' : statusActionLabel}
      </Button>
    </div>
  );

  return (
    <div className="bg-background min-h-screen">
      <EnhancedHeader
        unitDisplayName={unitDisplayName}
        periodDisplay={periodDisplay}
        tenantName={tenantName}
        managementSummary={managementSummaryText}
        managementDetails={managementDetails}
        leaseSummary={leaseSummaryParts.join(' • ')}
        status={logStatus}
        onBackToOverview={() => router.push('/monthly-logs')}
        actions={headerActions}
        relatedLogs={relatedLogs}
        currentLogId={monthlyLog.id}
        relatedLogsLoading={relatedLogsLoading}
        onRelatedLogSelect={handleRelatedLogSelect}
      />

      {transactionOverlayOpen ? (
        <MonthlyLogTransactionOverlay
          isOpen={transactionOverlayOpen}
          mode={transactionMode}
          onModeChange={setTransactionMode}
          onClose={() => setTransactionOverlayOpen(false)}
          allowedModes={allowedModes}
          leaseId={monthlyLog.activeLease?.id ?? ''}
          leaseSummary={leaseSummaryDetails}
          tenantOptions={tenantOptions}
          hasActiveLease={hasActiveLease}
          monthlyLogId={monthlyLog.id}
          propertyId={propertyId}
          propertyName={propertyName}
          unitId={unitId}
          unitLabel={unitLabel}
          orgId={orgId}
          addAssignedTransaction={addAssignedTransaction}
          removeAssignedTransaction={removeAssignedTransaction}
          refetchAssigned={refetchAssigned}
          refetchFinancial={refetchFinancial}
        />
      ) : null}

      {selectedTransactionDetail?.transaction_type === 'GeneralJournalEntry' ? (
        <JournalEntryDetailDialog
          open={transactionDetailDialogOpen}
          onOpenChange={setTransactionDetailDialogOpen}
          transaction={selectedTransactionDetail}
          onSaved={handleJournalEntrySaved}
        />
      ) : (
        <TransactionDetailDialog
          open={transactionDetailDialogOpen}
          onOpenChange={setTransactionDetailDialogOpen}
          transaction={selectedTransactionDetail}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}

      <div className="mx-auto w-full max-w-screen-2xl px-6 py-8 lg:px-8">
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,_3fr)_minmax(320px,_1fr)]">
          <div className="space-y-10">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Tabs
                  value={transactionScope}
                  onValueChange={(value) => setTransactionScope(value as 'lease' | 'unit')}
                  className="flex-1"
                >
                  <TabsList className="border-border flex gap-8 border-b bg-transparent p-0">
                    <TabsTrigger
                      value="lease"
                      disabled={!monthlyLog.activeLease?.id}
                      className={cn(
                        'text-muted-foreground rounded-none border-b-2 border-none border-transparent px-1 py-3 text-sm font-medium transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none',
                        'data-[state=active]:border-primary data-[state=active]:text-primary',
                        'data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:border-muted-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                      )}
                    >
                      Lease Transactions
                    </TabsTrigger>
                    <TabsTrigger
                      value="unit"
                      className={cn(
                        'text-muted-foreground rounded-none border-b-2 border-none border-transparent px-1 py-3 text-sm font-medium transition-colors focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none',
                        'data-[state=active]:border-primary data-[state=active]:text-primary',
                        'data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:border-muted-foreground',
                        'disabled:cursor-not-allowed disabled:opacity-40',
                      )}
                      disabled={!supportsUnitTransactions}
                    >
                      Unit Transactions
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  type="button"
                  size="sm"
                  className="ml-auto gap-2"
                  onClick={() => {
                    if (addTransactionDisabled) return;
                    setTransactionMode(allowedModes[0]);
                    setTransactionOverlayOpen(true);
                  }}
                  disabled={addTransactionDisabled}
                  title={addTransactionDisabledReason ?? undefined}
                >
                  Add transaction
                </Button>
              </div>

              <TransactionsSection
                assignedTransactions={visibleAssignedTransactions}
                unassignedTransactions={filteredUnassigned}
                loadingAssigned={loadingAssigned}
                loadingUnassigned={activeLoadingUnassigned}
                loadingMoreUnassigned={activeLoadingMoreUnassigned}
                hasMoreUnassigned={activeHasMoreUnassigned}
                onAssign={handleAssignTransaction}
                onUnassign={handleUnassignTransaction}
                onBulkUnassign={handleBulkUnassign}
                onBulkAssign={handleBulkAssign}
                onLoadMoreUnassigned={activeLoadMoreUnassigned}
                selectedAssigned={selectedAssigned}
                setSelectedAssigned={setSelectedAssigned}
                selectedUnassigned={selectedUnassigned}
                setSelectedUnassigned={setSelectedUnassigned}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                assignedSelectedCount={assignedSelectedCount}
                unassignedSelectedCount={unassignedSelectedCount}
                unassignedTypeFilter={unassignedTypeFilter}
                onTypeFilterChange={setUnassignedTypeFilter}
                unassignedSearch={unassignedSearch}
                onSearchChange={setUnassignedSearch}
                transactionScope={transactionScope}
                onTransactionClick={(transaction) => {
                  setSelectedTransactionDetail(transaction);
                  setTransactionDetailDialogOpen(true);
                }}
              />
            </section>

            <TasksPanel tasks={tasks} />

            <StatementsStage
              monthlyLogId={monthlyLog.id}
              propertyId={monthlyLog.properties?.id ?? null}
            />
          </div>

          <div className="space-y-6">
            <EnhancedFinancialSummaryCard
              summary={financialSummary}
              loading={loadingFinancial}
              onRefresh={refetchFinancial}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type TransactionsSectionProps = {
  assignedTransactions: Transaction[];
  unassignedTransactions: Transaction[];
  loadingAssigned: boolean;
  loadingUnassigned: boolean;
  loadingMoreUnassigned: boolean;
  hasMoreUnassigned: boolean;
  onAssign: (transactionId: string) => Promise<void>;
  onUnassign: (transactionId: string) => Promise<void>;
  onBulkUnassign: () => void | Promise<void>;
  onBulkAssign: () => void | Promise<void>;
  onLoadMoreUnassigned: () => Promise<void>;
  selectedAssigned: Set<string>;
  setSelectedAssigned: (value: Set<string>) => void;
  selectedUnassigned: Set<string>;
  setSelectedUnassigned: (value: Set<string>) => void;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  assignedSelectedCount: number;
  unassignedSelectedCount: number;
  unassignedTypeFilter: TransactionTypeFilter;
  onTypeFilterChange: (value: TransactionTypeFilter) => void;
  unassignedSearch: string;
  onSearchChange: (value: string) => void;
  transactionScope: 'lease' | 'unit';
  onTransactionClick: (transaction: Transaction) => void;
};

function TransactionsSection({
  assignedTransactions,
  unassignedTransactions,
  loadingAssigned,
  loadingUnassigned,
  loadingMoreUnassigned,
  hasMoreUnassigned,
  onAssign,
  onUnassign,
  onBulkUnassign,
  onBulkAssign,
  onLoadMoreUnassigned,
  selectedAssigned,
  setSelectedAssigned,
  selectedUnassigned,
  setSelectedUnassigned,
  formatCurrency,
  formatDate,
  assignedSelectedCount,
  unassignedSelectedCount,
  unassignedTypeFilter,
  onTypeFilterChange,
  unassignedSearch,
  onSearchChange,
  transactionScope,
  onTransactionClick,
}: TransactionsSectionProps) {
  const toggleAssignedSelection = (transactionId: string) => {
    const next = new Set(selectedAssigned);
    if (next.has(transactionId)) {
      next.delete(transactionId);
    } else {
      next.add(transactionId);
    }
    setSelectedAssigned(next);
  };

  const toggleUnassignedSelection = (transactionId: string) => {
    const next = new Set(selectedUnassigned);
    if (next.has(transactionId)) {
      next.delete(transactionId);
    } else {
      next.add(transactionId);
    }
    setSelectedUnassigned(next);
  };

  return (
    <section className="space-y-8">
      <div className="space-y-12">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Assigned transactions</h3>
              <p className="text-sm text-slate-500">
                Review current assignments and unassign if needed.
              </p>
            </div>
            {assignedSelectedCount > 0 ? (
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="border-blue-200 bg-blue-50 text-xs text-blue-700"
                >
                  {assignedSelectedCount} selected
                </Badge>
                <Button type="button" size="sm" variant="outline" onClick={onBulkUnassign}>
                  Unassign selected
                </Button>
              </div>
            ) : null}
          </div>

          <div className="max-h-[360px] overflow-auto">
            <Table className="min-w-[880px]">
              <TableHeader>
                <TableRow className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                  <TableHead className="w-10" />
                  <TableHead className="w-36">Date</TableHead>
                  <TableHead className="w-48">Account</TableHead>
                  <TableHead className="w-64">Memo</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead className="w-32 text-right">Amount</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingAssigned ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">
                      Loading assigned transactions…
                    </TableCell>
                  </TableRow>
                ) : assignedTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">
                      No transactions assigned yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  assignedTransactions.map((transaction) => {
                    // For GeneralJournalEntry (e.g., Tax Escrow), preserve the sign
                    // For other transaction types, use absolute value with type-based prefix
                    const isJournalEntry = transaction.transaction_type === 'GeneralJournalEntry';
                    const displayAmount = isJournalEntry
                      ? transaction.total_amount
                      : Math.abs(transaction.total_amount);
                    const amountFormatted = formatCurrency(displayAmount);
                    const typeLabel = getLeaseTransactionLabel(transaction.transaction_type);
                    const leaseLink = buildLeaseTransactionLink(transaction.lease_id);
                    const isUnitTransaction = transactionScope === 'unit' && !transaction.lease_id;
                    const handleRowClick = (e: React.MouseEvent) => {
                      // Don't trigger row click if clicking on checkbox, button, or link
                      const target = e.target as HTMLElement;
                      if (
                        target.closest('button') ||
                        target.closest('input[type="checkbox"]') ||
                        target.closest('a')
                      ) {
                        return;
                      }
                      if (isUnitTransaction) {
                        onTransactionClick(transaction);
                      }
                    };
                    return (
                      <TableRow
                        key={transaction.id}
                        className={cn(
                          'text-sm text-slate-700',
                          isUnitTransaction && 'cursor-pointer hover:bg-slate-50',
                        )}
                        onClick={handleRowClick}
                      >
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedAssigned.has(transaction.id)}
                            onCheckedChange={() => toggleAssignedSelection(transaction.id)}
                            aria-label={`Select transaction ${transaction.memo || transaction.id}`}
                          />
                        </TableCell>
                        <TableCell>{formatDate(transaction.date)}</TableCell>
                        <TableCell>{transaction.account_name ?? '—'}</TableCell>
                        <TableCell>{transaction.memo}</TableCell>
                        <TableCell>
                          {leaseLink ? (
                            <Link
                              href={leaseLink}
                              className="text-blue-600 underline-offset-2 hover:underline"
                            >
                              {typeLabel}
                            </Link>
                          ) : (
                            typeLabel
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-slate-900">
                          {isJournalEntry
                            ? amountFormatted
                            : `${transaction.transaction_type === 'Charge' ? '+' : '-'}${amountFormatted}`}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUnassign(transaction.id);
                            }}
                          >
                            Unassign
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Unassigned transactions</h3>
              <p className="text-sm text-slate-500">Assign transactions directly from this list.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {unassignedSelectedCount > 0 ? (
                <>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-xs text-blue-700"
                  >
                    {unassignedSelectedCount} selected
                  </Badge>
                  <Button type="button" size="sm" variant="outline" onClick={onBulkAssign}>
                    Assign selected
                  </Button>
                </>
              ) : null}
              <Select
                value={unassignedTypeFilter}
                onValueChange={(value: TransactionTypeFilter) => onTypeFilterChange(value)}
              >
                <SelectTrigger className="h-10 w-[180px] text-sm">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="Charge">Charges</SelectItem>
                  <SelectItem value="Credit">Credits</SelectItem>
                  <SelectItem value="Payment">Payments</SelectItem>
                  <SelectItem value="Bill">Bills</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={unassignedSearch}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search memo or reference"
                  className="h-10 w-[240px] rounded-xl pl-9 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="max-h-[320px] overflow-auto">
            <Table className="min-w-[880px]">
              <TableHeader>
                <TableRow className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                  <TableHead className="w-10" />
                  <TableHead className="w-36">Date</TableHead>
                  <TableHead className="w-48">Account</TableHead>
                  <TableHead className="w-64">Memo</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead className="w-32 text-right">Amount</TableHead>
                  <TableHead className="w-40">Reference</TableHead>
                  <TableHead className="w-28 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUnassigned ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-500">
                      Loading unassigned transactions…
                    </TableCell>
                  </TableRow>
                ) : unassignedTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-500">
                      No transactions available.
                    </TableCell>
                  </TableRow>
                ) : (
                  unassignedTransactions.map((transaction) => (
                    <TableRow key={transaction.id} className="text-sm text-slate-700">
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedUnassigned.has(transaction.id)}
                          onCheckedChange={() => toggleUnassignedSelection(transaction.id)}
                          aria-label={`Select transaction ${transaction.memo || transaction.id}`}
                        />
                      </TableCell>
                      <TableCell>{formatDate(transaction.date)}</TableCell>
                      <TableCell>{transaction.account_name ?? '—'}</TableCell>
                      <TableCell>{transaction.memo}</TableCell>
                      <TableCell>
                        {getLeaseTransactionLabel(transaction.transaction_type)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {transaction.transaction_type === 'Charge' ? '+' : '-'}
                        {formatCurrency(Math.abs(transaction.total_amount))}
                      </TableCell>
                      <TableCell>{transaction.reference_number ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" onClick={() => onAssign(transaction.id)}>
                          Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {hasMoreUnassigned ? (
            <div className="flex justify-center border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void onLoadMoreUnassigned()}
                disabled={loadingMoreUnassigned}
              >
                {loadingMoreUnassigned ? 'Loading…' : 'Load more transactions'}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
}

type TasksPanelProps = {
  tasks: MonthlyLogTaskSummary[];
};

function TasksPanel({ tasks }: TasksPanelProps) {
  return (
    <section className="bg-white px-8 py-8 ring-1 ring-slate-200">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Tasks linked to this log</h2>
            <p className="text-sm text-slate-500">Track outstanding follow-ups and assignments.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.open('/tasks', '_blank')}
        >
          Open tasks workspace
        </Button>
      </header>

      {tasks.length === 0 ? (
        <div className="border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-sm text-slate-500">
          No tasks linked to this monthly log yet.
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-col gap-3 border border-slate-200 bg-white p-5 transition hover:border-slate-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium',
                      TASK_STATUS_BADGE[task.statusKey],
                    )}
                  >
                    {task.statusLabel}
                  </Badge>
                  <span className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="h-3.5 w-3.5" />
                    Updated {task.updatedRelativeLabel}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full',
                        TASK_PRIORITY_DOT[task.priorityKey],
                      )}
                    />
                    {task.priorityLabel}
                  </span>
                  {task.categoryLabel ? <span>• {task.categoryLabel}</span> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{task.subject}</div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Due {task.dueDateLabel}</span>
                  {task.assignedToLabel ? (
                    <span className="flex items-center gap-2">
                      <UserCheck className="h-3.5 w-3.5" />
                      {task.assignedToLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
