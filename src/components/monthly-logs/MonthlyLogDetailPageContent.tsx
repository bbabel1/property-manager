'use client';

import { useCallback, useEffect, useMemo, useState, useId } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { ClipboardList, Clock, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/components/ui/utils';
import DestructiveActionModal from '@/components/common/DestructiveActionModal';
import EnhancedFinancialSummaryCard from '@/components/monthly-logs/EnhancedFinancialSummaryCard';
import EnhancedHeader from '@/components/monthly-logs/EnhancedHeader';
import StatementsStage from '@/components/monthly-logs/StatementsStage';
import TransactionDetailDialog from '@/components/monthly-logs/TransactionDetailDialog';
import JournalEntryDetailDialog from '@/components/monthly-logs/JournalEntryDetailDialog';
import RecurringTasksForUnit from '@/components/monthly-logs/RecurringTasksForUnit';
import TransactionActionBar from '@/components/monthly-logs/TransactionActionBar';
import TransactionTabs from '@/components/monthly-logs/TransactionTabs';
import TaskCreateDialog from '@/components/monthly-logs/TaskCreateDialog';
import type { MonthlyLogStatus, MonthlyLogTaskSummary } from '@/components/monthly-logs/types';
import { useMonthlyLogData } from '@/hooks/useMonthlyLogData';
import MonthlyLogTransactionOverlay, {
  type TransactionMode,
} from '@/components/monthly-logs/MonthlyLogTransactionOverlay';
import type { LeaseTenantOption } from '@/components/leases/types';
import { formatCurrency, formatDate } from '@/lib/transactions/formatting';
import type { MonthlyLogFinancialSummary, MonthlyLogTransaction } from '@/types/monthly-log';
import { addMonths, subDays } from 'date-fns';

type RelatedLogOption = {
  id: string;
  label: string;
  status: MonthlyLogStatus | string;
};

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
  on_hold: 'bg-slate-100 text-slate-700 border border-slate-300',
  cancelled: 'bg-slate-100 text-slate-600 border border-slate-300',
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
  const [assignedSearch, setAssignedSearch] = useState('');
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
  }, [
    transactionScope,
    hasActiveLease,
    supportsUnitTransactions,
    loadLeaseUnassigned,
    loadUnitUnassigned,
  ]);

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
  const [selectedTransactionScope, setSelectedTransactionScope] = useState<
    'assigned' | 'unassigned' | null
  >(null);
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
        const text = await response.text();
        let errorData: { error?: { message?: string } } = {};
        try {
          errorData = text ? JSON.parse(text) : {};
        } catch {
          errorData = { error: { message: `Request failed with status ${response.status}` } };
        }
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

  const openDeleteConfirmation = useCallback((ids: string[], scope: 'assigned' | 'unassigned') => {
    if (!ids.length) return;
    setConfirmState({
      open: true,
      ids,
      scope,
      title: ids.length === 1 ? 'Delete transaction?' : 'Delete selected transactions?',
      description:
        'This action cannot be undone and will remove the transaction from this monthly log.',
    });
  }, []);

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
    (transaction: MonthlyLogTransaction | null): { href: string | null; reason: string | null } => {
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
        target.reason ?? 'Editing for this transaction type is managed in its source workspace.',
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
        const text = await response.text();
        let errorData: { error?: { message?: string } } = {};
        try {
          errorData = text ? JSON.parse(text) : {};
        } catch {
          errorData = { error: { message: `Request failed with status ${response.status}` } };
        }
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

      <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,_3fr)_minmax(320px,_1fr)] lg:gap-10">
          <div className="space-y-6">
            {/* Transaction Controls and Tables */}
            <section className="space-y-6">
              <TransactionActionBar
                scopeFieldId={scopeFieldId}
                transactionScope={transactionScope}
                onScopeChange={setTransactionScope}
                hasActiveLease={hasActiveLease}
                supportsUnitTransactions={supportsUnitTransactions}
                transactionMode={transactionMode}
                onTransactionModeChange={setTransactionMode}
                transactionModeMenuOpen={transactionModeMenuOpen}
                onTransactionModeMenuOpenChange={setTransactionModeMenuOpen}
                allowedModes={allowedModes}
                onAddTransaction={() => {
                  if (addTransactionDisabled) return;
                  setTransactionOverlayOpen(true);
                }}
                addTransactionDisabled={addTransactionDisabled}
                addTransactionDisabledReason={addTransactionDisabledReason}
              />

              <TransactionTabs
                assignedTransactions={visibleAssignedTransactions}
                unassignedTransactions={activeUnassignedRaw}
                assignedSearch={assignedSearch}
                onAssignedSearchChange={setAssignedSearch}
                unassignedSearch={unassignedSearch}
                onUnassignedSearchChange={setUnassignedSearch}
                loadingAssigned={loadingAssigned}
                loadingUnassigned={activeLoadingUnassigned}
                selectedAssigned={selectedAssigned}
                selectedUnassigned={selectedUnassigned}
                onToggleAssignedSelection={(id) =>
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
                onToggleAllAssigned={(checked) =>
                  setSelectedAssigned(
                    checked
                      ? new Set(visibleAssignedTransactions.map((transaction) => transaction.id))
                      : new Set(),
                  )
                }
                onToggleUnassignedSelection={(id) =>
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
                onToggleAllUnassigned={(checked) =>
                  setSelectedUnassigned(
                    checked
                      ? new Set(activeUnassignedRaw.map((transaction) => transaction.id))
                      : new Set(),
                  )
                }
                onAssignedRowClick={(transaction) => {
                  setSelectedTransactionDetail(transaction);
                  setSelectedTransactionScope('assigned');
                  setTransactionDetailDialogOpen(true);
                }}
                onUnassignedRowClick={(transaction) => {
                  setSelectedTransactionDetail(transaction);
                  setSelectedTransactionScope('unassigned');
                  setTransactionDetailDialogOpen(true);
                }}
                assignedStickyActions={
                  assignedSelectedCount > 0 ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
                      >
                        {assignedSelectedCount} selected
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleBulkUnassign}
                      >
                        Unassign
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                      Assigned
                    </div>
                  )
                }
                unassignedStickyActions={
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
                    <div className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                      Unassigned
                    </div>
                  )
                }
                hasMoreUnassigned={activeHasMoreUnassigned}
                onLoadMoreUnassigned={activeLoadMoreUnassigned}
                loadingMoreUnassigned={activeLoadingMoreUnassigned}
              />
            </section>

            <TasksPanel
              tasks={tasks}
              monthlyLogId={monthlyLog.id}
              periodStart={monthlyLog.period_start}
              propertyId={monthlyLog.property_id}
              unitId={monthlyLog.unit_id}
              propertyName={monthlyLog.properties?.name ?? null}
              unitLabel={monthlyLog.units?.unit_name ?? monthlyLog.units?.unit_number ?? null}
            />

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
  monthlyLogId: string;
  periodStart: string;
  propertyId: string | null;
  unitId: string | null;
  propertyName?: string | null;
  unitLabel?: string | null;
};

function TasksPanel({
  tasks,
  monthlyLogId,
  periodStart,
  propertyId,
  unitId,
  propertyName,
  unitLabel,
}: TasksPanelProps) {
  const initialDueDate = useMemo(() => {
    if (!periodStart) return '';
    const parsed = new Date(periodStart);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
  }, [periodStart]);

  const [items, setItems] = useState<MonthlyLogTaskSummary[]>(tasks);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [quickSubject, setQuickSubject] = useState('');
  const [quickDueDate, setQuickDueDate] = useState(initialDueDate);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    setItems(tasks);
  }, [tasks]);

  const handleQuickAdd = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!quickSubject.trim()) {
        toast.error('Subject is required.');
        return;
      }
      setSaving(true);
      try {
        let dueDateIso: string | null = null;
        if (quickDueDate && quickDueDate.trim()) {
          const parsedDate = new Date(quickDueDate);
          dueDateIso = Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
        }

        const response = await fetch(`/api/monthly-logs/${monthlyLogId}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: quickSubject,
            description: null,
            dueDate: dueDateIso,
            priority: 'normal',
            status: 'new',
            category: null,
            assignedTo: null,
          }),
        });

        const bodyText = await response.text();
        let parsed: { error?: string } | MonthlyLogTaskSummary = {};
        try {
          parsed = bodyText ? JSON.parse(bodyText) : {};
        } catch {
          parsed = {};
        }
        if (!response.ok) {
          throw new Error(
            (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) ||
              'Failed to create task',
          );
        }

        const created = parsed as MonthlyLogTaskSummary;
        setItems((prev) => [created, ...prev]);
        toast.success('Task created');
        setQuickSubject('');
        setQuickDueDate(initialDueDate);
      } catch (error) {
        console.error('Failed to create monthly log task', error);
        toast.error((error as Error)?.message || 'Could not create task');
      } finally {
        setSaving(false);
      }
    },
    [quickSubject, quickDueDate, initialDueDate, monthlyLogId],
  );

  const handleTaskCreated = useCallback((task: MonthlyLogTaskSummary) => {
    setItems((prev) => [task, ...prev]);
  }, []);

  return (
    <section className="bg-white px-4 py-4 ring-1 ring-slate-300 sm:px-6 sm:py-5">
      {/* Compact Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-slate-700" />
          <h2 className="text-base font-semibold text-slate-900">
            Tasks
            {items.length > 0 && (
              <Badge
                variant="outline"
                className="ml-2 rounded-full border-slate-400 bg-slate-200 px-1.5 py-0 text-xs font-medium"
              >
                {items.length}
              </Badge>
            )}
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => window.open('/tasks', '_blank')}
          className="h-8 text-xs text-slate-700 hover:bg-slate-200 hover:text-slate-900"
        >
          Open workspace
        </Button>
      </div>

      {/* Recurring Tasks - Compact */}
      <div className="mb-4">
        <RecurringTasksForUnit
          propertyId={propertyId}
          unitId={unitId}
          propertyName={propertyName ?? undefined}
          unitLabel={unitLabel ?? undefined}
        />
      </div>

      {/* Streamlined Quick Add Form */}
      <form
        onSubmit={handleQuickAdd}
        className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-slate-300 bg-slate-100 p-2.5 sm:flex-nowrap"
      >
        <div className="min-w-0 flex-1">
          <Input
            id="quick-subject"
            value={quickSubject}
            onChange={(event) => setQuickSubject(event.target.value)}
            placeholder="Quick add task..."
            disabled={saving}
            required
            className="h-9 bg-white text-sm"
          />
        </div>
        <div className="w-full sm:w-[140px]">
          <Input
            id="quick-due-date"
            type="date"
            value={quickDueDate}
            onChange={(event) => setQuickDueDate(event.target.value)}
            disabled={saving}
            className="h-9 bg-white text-sm"
          />
        </div>
        <div className="flex w-full gap-1.5 sm:w-auto">
          <Button
            type="submit"
            size="sm"
            disabled={saving || !quickSubject.trim()}
            className="h-9 flex-1 px-3 sm:flex-initial"
          >
            {saving ? 'Adding…' : 'Add'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDialogOpen(true)}
            disabled={saving}
            className="h-9 px-2 text-xs"
          >
            More
          </Button>
        </div>
      </form>

      <TaskCreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        monthlyLogId={monthlyLogId}
        initialDueDate={initialDueDate}
        onTaskCreated={handleTaskCreated}
      />

      {/* Task List */}
      {items.length === 0 ? (
        <div className="border border-dashed border-slate-400 bg-slate-100 p-6 text-center text-sm text-slate-600">
          No tasks linked to this monthly log yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((task) => (
            <div
              key={task.id}
              className="group flex items-start justify-between gap-3 rounded-lg border border-slate-300 bg-white p-3 transition hover:border-slate-400 hover:bg-slate-100 hover:shadow-sm"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-medium',
                      TASK_STATUS_BADGE[task.statusKey],
                    )}
                  >
                    {task.statusLabel}
                  </Badge>
                  <span
                    className={cn('h-1.5 w-1.5 rounded-full', TASK_PRIORITY_DOT[task.priorityKey])}
                  />
                  {task.categoryLabel && (
                    <span className="text-xs text-slate-600">{task.categoryLabel}</span>
                  )}
                </div>
                <div className="text-sm font-medium text-slate-900">{task.subject}</div>
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Due {task.dueDateLabel}
                  </span>
                  {task.assignedToLabel && (
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-3 w-3" />
                      {task.assignedToLabel}
                    </span>
                  )}
                  <span>Updated {task.updatedRelativeLabel}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
