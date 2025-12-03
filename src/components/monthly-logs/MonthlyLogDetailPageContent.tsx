'use client';

import { useCallback, useEffect, useMemo, useState, useId } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  Clock,
  Search,
  UserCheck,
  ChevronDown,
  Check,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/components/ui/utils';
import DestructiveActionModal from '@/components/common/DestructiveActionModal';
import EnhancedFinancialSummaryCard from '@/components/monthly-logs/EnhancedFinancialSummaryCard';
import EnhancedHeader from '@/components/monthly-logs/EnhancedHeader';
import StatementsStage from '@/components/monthly-logs/StatementsStage';
import TransactionDetailDialog from '@/components/monthly-logs/TransactionDetailDialog';
import JournalEntryDetailDialog from '@/components/monthly-logs/JournalEntryDetailDialog';
import TransactionTable from '@/components/monthly-logs/TransactionTable';
import type { MonthlyLogStatus, MonthlyLogTaskSummary } from '@/components/monthly-logs/types';
import { useMonthlyLogData } from '@/hooks/useMonthlyLogData';
import MonthlyLogTransactionOverlay, {
  type TransactionMode,
} from '@/components/monthly-logs/MonthlyLogTransactionOverlay';
import type { LeaseTenantOption } from '@/components/leases/types';
import {
  formatCurrency,
  formatDate,
} from '@/lib/transactions/formatting';
import type { MonthlyLogFinancialSummary, MonthlyLogTransaction } from '@/types/monthly-log';
import { addMonths, subDays } from 'date-fns';

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

const UNIT_TRANSACTION_MODES: TransactionMode[] = [
  'bill',
  'managementFee',
  'propertyTaxEscrow',
  'ownerDraw',
];

const TRANSACTION_MODE_LABELS: Record<TransactionMode, string> = {
  payment: 'Payment',
  charge: 'Charge',
  credit: 'Credit',
  refund: 'Refund',
  deposit: 'Deposit',
  bill: 'Bill',
  managementFee: 'Management fee',
  propertyTaxEscrow: 'Escrow',
  ownerDraw: 'Owner draw',
};

interface MonthlyLogDetailPageContentProps {
  monthlyLog: {
    id: string;
    period_start: string;
    stage: string;
    status: MonthlyLogStatus;
    notes: string | null;
    lease_id: number | null;
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
  const scopeFieldId = useId();
  const [logStatus, setLogStatus] = useState<MonthlyLogStatus>(monthlyLog.status);
  const [updatingStatus, setUpdatingStatus] = useState(false);
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

  const activeLeaseId = monthlyLog.activeLease?.id ?? monthlyLog.lease_id ?? null;
  const hasActiveLease = Boolean(activeLeaseId);
  const supportsUnitTransactions = Boolean(monthlyLog.unit_id);
  const defaultTransactionScope: 'lease' | 'unit' = hasActiveLease ? 'lease' : 'unit';
  const [transactionScope, setTransactionScope] = useState<'lease' | 'unit'>(
    defaultTransactionScope,
  );
  const [loadLeaseUnassigned, setLoadLeaseUnassigned] = useState<boolean>(Boolean(activeLeaseId));
  const [loadUnitUnassigned, setLoadUnitUnassigned] = useState<boolean>(
    defaultTransactionScope === 'unit' && supportsUnitTransactions,
  );

  useEffect(() => {
    if (transactionScope === 'lease' && hasActiveLease && !loadLeaseUnassigned) {
      setLoadLeaseUnassigned(true);
    }
    if (transactionScope === 'unit' && supportsUnitTransactions && !loadUnitUnassigned) {
      setLoadUnitUnassigned(true);
    }
  }, [transactionScope, hasActiveLease, supportsUnitTransactions, loadLeaseUnassigned, loadUnitUnassigned]);

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
    removeUnassignedTransaction,
    refetchAssigned,
    refetchFinancial,
    loadMoreUnassigned: loadMoreLeaseUnassigned,
    loadMoreUnitUnassigned,
  } = useMonthlyLogData(monthlyLog.id, {
    initialAssigned: initialData?.assignedTransactions,
    initialSummary: initialData?.financialSummary,
    initialUnassigned: initialData?.unassignedTransactions,
    initialUnassignedCursor: initialData?.unassignedCursor ?? null,
    leaseId: activeLeaseId,
    unitId: monthlyLog.unit_id ?? null,
    loadLeaseUnassigned,
    loadUnitUnassigned,
  });
  const defaultTransactionMode: TransactionMode = hasActiveLease ? 'payment' : 'bill';
  const [transactionMode, setTransactionMode] = useState<TransactionMode>(defaultTransactionMode);
  const [transactionModeMenuOpen, setTransactionModeMenuOpen] = useState(false);
  const [transactionOverlayOpen, setTransactionOverlayOpen] = useState(false);
  const [selectedTransactionDetail, setSelectedTransactionDetail] =
    useState<MonthlyLogTransaction | null>(null);
  const [selectedTransactionScope, setSelectedTransactionScope] =
    useState<'assigned' | 'unassigned' | null>(null);
  const [transactionDetailDialogOpen, setTransactionDetailDialogOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    ids: string[];
    scope: 'assigned' | 'unassigned';
    title: string;
    description: string;
  }>({ open: false, ids: [], scope: 'assigned', title: '', description: '' });
  const [confirmProcessing, setConfirmProcessing] = useState(false);
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

  const filterUnassignedTransactions = useCallback(
    (transactions: MonthlyLogTransaction[]) => {
      if (!transactions.length) return [];
      const search = unassignedSearch.trim().toLowerCase();
      return transactions.filter((transaction) => {
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
    [unassignedSearch],
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
    if (!activeLeaseId) return assignedTransactions;
    return assignedTransactions.filter((transaction) => transaction.lease_id === activeLeaseId);
  }, [activeLeaseId, assignedTransactions]);

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

        await refetchFinancial();
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
      await refetchFinancial();
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

  const openDeleteConfirmation = useCallback(
    (ids: string[], scope: 'assigned' | 'unassigned') => {
      if (!ids.length) return;
      setConfirmState({
        open: true,
        ids,
        scope,
        title: ids.length === 1 ? 'Delete transaction?' : 'Delete selected transactions?',
        description:
          'This action cannot be undone and will remove the transaction from this monthly log.',
      });
    },
    [],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmState.open || !confirmState.ids.length) return;
    setConfirmProcessing(true);
    const { ids, scope } = confirmState;
    try {
      await Promise.all(
        ids.map((transactionId) =>
          fetch(`/api/monthly-logs/${monthlyLog.id}/transactions/${transactionId}`, {
            method: 'DELETE',
          }),
        ),
      );

      ids.forEach((id) => {
        if (scope === 'assigned') {
          removeAssignedTransaction(id);
        } else {
          removeUnassignedTransaction(id);
        }
      });

      if (scope === 'assigned') {
        setSelectedAssigned((current) => {
          const next = new Set(current);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      } else {
        setSelectedUnassigned(new Set());
      }

      await refetchFinancial();
      toast.success(`Deleted ${ids.length} transaction${ids.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Error deleting transaction', error);
      toast.error('Failed to delete transaction');
    } finally {
      setConfirmProcessing(false);
      setConfirmState((prev) => ({ ...prev, open: false, ids: [] }));
    }
  }, [
    confirmState,
    monthlyLog.id,
    refetchFinancial,
    removeAssignedTransaction,
    removeUnassignedTransaction,
  ]);

  const resolveEditTarget = useCallback(
    (
      transaction: MonthlyLogTransaction | null,
    ): { href: string | null; reason: string | null } => {
      if (!transaction) {
        return { href: null, reason: null };
      }

      const returnToParam = new URLSearchParams({
        returnTo: `/monthly-logs/${monthlyLog.id}`,
      }).toString();

      if (transaction.transaction_type === 'Bill') {
        return {
          href: `/bills/${transaction.id}/edit?${returnToParam}`,
          reason: null,
        };
      }

      if (transaction.lease_id) {
        return {
          href: `/leases/${transaction.lease_id}?tab=financials&${returnToParam}`,
          reason: null,
        };
      }

      return {
        href: null,
        reason:
          'Edit this transaction from its source workspace (e.g., bills, management fees, or journal entries).',
      };
    },
    [monthlyLog.id],
  );

  const handleEditTransaction = useCallback(
    (transaction: MonthlyLogTransaction | null) => {
      if (!transaction) return;
      const target = resolveEditTarget(transaction);

      if (target.href) {
        router.push(target.href);
        setTransactionDetailDialogOpen(false);
        return;
      }

      toast.info(
        target.reason ??
          'Editing for this transaction type is managed in its source workspace.',
      );
    },
    [resolveEditTarget, router],
  );

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

  const toLocalDate = (value: string) => {
    const [year, month, day] = value.split('-').map((part) => parseInt(part, 10));
    if (
      Number.isFinite(year) &&
      Number.isFinite(month) &&
      Number.isFinite(day) &&
      year > 0 &&
      month > 0 &&
      day > 0
    ) {
      return new Date(year, month - 1, day);
    }
    return new Date(value);
  };

  const periodStart = toLocalDate(monthlyLog.period_start);
  const periodDisplay = periodStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const periodEnd = subDays(addMonths(periodStart, 1), 1);
  const formatAsShortDate = (date: Date) =>
    date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const periodStartDisplay = formatAsShortDate(periodStart);
  const periodEndDisplay = formatAsShortDate(periodEnd);

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

  const addTransactionDisabled =
    transactionScope === 'lease' ? !hasActiveLease : !supportsUnitTransactions;
  const addTransactionDisabledReason = addTransactionDisabled
    ? transactionScope === 'lease'
      ? 'Link an active lease to this monthly log to add lease transactions.'
      : 'Unit information is required before adding unit transactions.'
    : null;
  const transactionModeLabel = TRANSACTION_MODE_LABELS[transactionMode] ?? 'Transaction';
  const selectedEditIntent = useMemo(
    () => resolveEditTarget(selectedTransactionDetail),
    [resolveEditTarget, selectedTransactionDetail],
  );

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
        periodStartDisplay={periodStartDisplay}
        periodEndDisplay={periodEndDisplay}
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
          leaseId={activeLeaseId ? String(activeLeaseId) : ''}
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
          financialSummary={financialSummary}
          periodStart={monthlyLog.period_start}
          activeLease={activeLease}
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
          onEdit={handleEditTransaction}
          onDelete={
            selectedTransactionScope && selectedTransactionDetail
              ? () => {
                  openDeleteConfirmation([selectedTransactionDetail.id], selectedTransactionScope);
                  setTransactionDetailDialogOpen(false);
                }
              : undefined
          }
          editDisabledReason={selectedEditIntent.reason}
        />
      )}

      <div className="mx-auto w-full max-w-screen-2xl px-6 py-6 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,_3fr)_minmax(320px,_1fr)]">
          <div className="space-y-10">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-end gap-4 sm:gap-6">
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-700 min-w-[220px]">
                  <span className="text-sm font-semibold text-slate-800">Scope:</span>
                  <RadioGroup
                    value={transactionScope}
                    onValueChange={(value) => setTransactionScope(value as 'lease' | 'unit')}
                    className="flex items-center gap-4 min-w-[160px]"
                    aria-label="Transaction scope"
                  >
                    {hasActiveLease ? (
                      <Label htmlFor={`${scopeFieldId}-lease`} className="text-slate-700">
                        <RadioGroupItem value="lease" id={`${scopeFieldId}-lease`} className="peer" />
                        <span>Lease</span>
                      </Label>
                    ) : null}
                    {supportsUnitTransactions ? (
                      <Label htmlFor={`${scopeFieldId}-unit`} className="text-slate-700">
                        <RadioGroupItem value="unit" id={`${scopeFieldId}-unit`} className="peer" />
                        <span>Unit</span>
                      </Label>
                    ) : null}
                  </RadioGroup>
                  {!hasActiveLease && !supportsUnitTransactions ? (
                    <span className="text-slate-400">Unavailable</span>
                  ) : null}
                </div>
                <DropdownMenu
                  open={transactionModeMenuOpen}
                  onOpenChange={(open) => setTransactionModeMenuOpen(open)}
                >
                  <div className="inline-flex min-w-[180px] justify-start">
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 justify-between"
                        disabled={addTransactionDisabled}
                      >
                        {transactionModeLabel}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </div>
                  <DropdownMenuContent align="end">
                    {allowedModes.map((mode) => {
                      const label = TRANSACTION_MODE_LABELS[mode] ?? mode;
                      return (
                        <DropdownMenuItem
                          key={mode}
                          onSelect={(event) => {
                            event.preventDefault();
                            setTransactionMode(mode);
                            setTransactionModeMenuOpen(false);
                          }}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span>{label}</span>
                            {mode === transactionMode ? <Check className="h-4 w-4 text-green-600" /> : null}
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="inline-flex min-w-[180px] justify-start">
                  <Button
                    type="button"
                    size="sm"
                    className="w-full gap-2 justify-center"
                    onClick={() => {
                      if (addTransactionDisabled) return;
                      setTransactionOverlayOpen(true);
                    }}
                    disabled={addTransactionDisabled}
                  >
                    Add {transactionModeLabel.toLowerCase()}
                  </Button>
                </div>
              </div>

              {addTransactionDisabledReason ? (
                <p className="text-xs text-slate-500">{addTransactionDisabledReason}</p>
              ) : null}

              {(!hasActiveLease || !supportsUnitTransactions) ? (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <div className="space-y-1.5">
                    {!hasActiveLease ? (
                      <p className="leading-snug">
                        Lease transactions are disabled until you link an active lease to this monthly log.
                        You can attach a lease from the unit’s lease workspace.
                      </p>
                    ) : null}
                    {!supportsUnitTransactions ? (
                      <p className="leading-snug">
                        Unit transactions require this monthly log to be linked to a unit. Add the unit to the log to enable unit transactions.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <section className="space-y-10">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Assigned transactions</h3>
                      <p className="text-sm text-slate-500">
                        Review current assignments and unassign if needed.
                      </p>
                    </div>
                  </div>
                  <TransactionTable
                    transactions={visibleAssignedTransactions}
                    loading={loadingAssigned}
                    selectedIds={selectedAssigned}
                    onToggleSelection={(id) =>
                      setSelectedAssigned((current) => {
                        const next = new Set(current);
                        if (next.has(id)) {
                          next.delete(id);
                        } else {
                          next.add(id);
                        }
                        return next;
                      })
                    }
                    onToggleAll={(checked) =>
                      setSelectedAssigned(
                        checked
                          ? new Set(visibleAssignedTransactions.map((transaction) => transaction.id))
                          : new Set(),
                      )
                    }
                    onRowClick={(transaction) => {
                      setSelectedTransactionDetail(transaction);
                      setSelectedTransactionScope('assigned');
                      setTransactionDetailDialogOpen(true);
                    }}
                    stickyActions={
                      assignedSelectedCount > 0 ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
                          >
                            {assignedSelectedCount} selected
                          </Badge>
                          <Button type="button" size="sm" variant="outline" onClick={handleBulkUnassign}>
                            Unassign
                          </Button>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Assigned
                        </div>
                      )
                    }
                    emptyTitle="No transactions assigned yet."
                    emptyDescription="Assign or create transactions to see them in this list."
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Unassigned transactions</h3>
                      <p className="text-sm text-slate-500">Assign transactions directly from this list.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative w-full sm:w-[200px] md:w-[240px]">
                        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          value={unassignedSearch}
                          onChange={(event) => setUnassignedSearch(event.target.value)}
                          placeholder="Search memo or reference"
                          className="h-10 w-full rounded-xl pl-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <TransactionTable
                    transactions={filteredUnassigned}
                    loading={activeLoadingUnassigned}
                    selectedIds={selectedUnassigned}
                    onToggleSelection={(id) =>
                      setSelectedUnassigned((current) => {
                        const next = new Set(current);
                        if (next.has(id)) {
                          next.delete(id);
                        } else {
                          next.add(id);
                        }
                        return next;
                      })
                    }
                    onToggleAll={(checked) =>
                      setSelectedUnassigned(
                        checked
                          ? new Set(filteredUnassigned.map((transaction) => transaction.id))
                          : new Set(),
                      )
                    }
                    onRowClick={(transaction) => {
                      setSelectedTransactionDetail(transaction);
                      setSelectedTransactionScope('unassigned');
                      setTransactionDetailDialogOpen(true);
                    }}
                    stickyActions={
                      unassignedSelectedCount > 0 ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
                          >
                            {unassignedSelectedCount} selected
                          </Badge>
                          <Button type="button" size="sm" variant="outline" onClick={handleBulkAssign}>
                            Assign
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() =>
                              openDeleteConfirmation(Array.from(selectedUnassigned), 'unassigned')
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      ) : (
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Unassigned
                        </div>
                      )
                    }
                    emptyTitle="No transactions available."
                    emptyDescription="New transactions will appear here when they match this scope."
                  />

                  {activeHasMoreUnassigned ? (
                    <div className="flex justify-center border-t border-slate-100 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void activeLoadMoreUnassigned()}
                        disabled={activeLoadingMoreUnassigned}
                      >
                        {activeLoadingMoreUnassigned ? 'Loading…' : 'Load more transactions'}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </section>
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

      <DestructiveActionModal
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((prev) => ({ ...prev, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="Delete"
        isProcessing={confirmProcessing}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

type TasksPanelProps = {
  tasks: MonthlyLogTaskSummary[];
};

function TasksPanel({ tasks }: TasksPanelProps) {
  return (
    <section className="bg-white px-4 py-6 ring-1 ring-slate-200 sm:px-6 lg:px-8 lg:py-8">
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
