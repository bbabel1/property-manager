'use client';

import { memo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import TransactionActionBar from '@/components/monthly-logs/TransactionActionBar';
import TransactionTabs from '@/components/monthly-logs/TransactionTabs';
import type { MonthlyLogTransaction } from '@/types/monthly-log';
import type { TransactionMode } from '@/components/monthly-logs/MonthlyLogTransactionOverlay';

interface MonthlyLogTransactionsSectionProps {
  scopeFieldId: string;
  transactionScope: 'lease' | 'unit';
  onScopeChange: (scope: 'lease' | 'unit') => void;
  hasActiveLease: boolean;
  supportsUnitTransactions: boolean;
  transactionMode: TransactionMode;
  onTransactionModeChange: (mode: TransactionMode) => void;
  transactionModeMenuOpen: boolean;
  onTransactionModeMenuOpenChange: (open: boolean) => void;
  allowedModes: TransactionMode[];
  onAddTransaction: () => void;
  addTransactionDisabled: boolean;
  addTransactionDisabledReason: string | null;
  assignedTransactions: MonthlyLogTransaction[];
  unassignedTransactions: MonthlyLogTransaction[];
  assignedSearch: string;
  onAssignedSearchChange: (value: string) => void;
  unassignedSearch: string;
  onUnassignedSearchChange: (value: string) => void;
  loadingAssigned: boolean;
  loadingUnassigned: boolean;
  selectedAssigned: Set<string>;
  selectedUnassigned: Set<string>;
  onToggleAssignedSelection: (id: string) => void;
  onToggleAllAssigned: (checked: boolean) => void;
  onToggleUnassignedSelection: (id: string) => void;
  onToggleAllUnassigned: (checked: boolean) => void;
  onAssignedRowClick: (transaction: MonthlyLogTransaction) => void;
  onUnassignedRowClick: (transaction: MonthlyLogTransaction) => void;
  onBulkUnassign: () => void;
  onBulkAssign: () => void;
  onDeleteUnassigned: () => void;
  hasMoreUnassigned: boolean;
  onLoadMoreUnassigned: () => Promise<void>;
  loadingMoreUnassigned: boolean;
}

function MonthlyLogTransactionsSectionComponent({
  scopeFieldId,
  transactionScope,
  onScopeChange,
  hasActiveLease,
  supportsUnitTransactions,
  transactionMode,
  onTransactionModeChange,
  transactionModeMenuOpen,
  onTransactionModeMenuOpenChange,
  allowedModes,
  onAddTransaction,
  addTransactionDisabled,
  addTransactionDisabledReason,
  assignedTransactions,
  unassignedTransactions,
  assignedSearch,
  onAssignedSearchChange,
  unassignedSearch,
  onUnassignedSearchChange,
  loadingAssigned,
  loadingUnassigned,
  selectedAssigned,
  selectedUnassigned,
  onToggleAssignedSelection,
  onToggleAllAssigned,
  onToggleUnassignedSelection,
  onToggleAllUnassigned,
  onAssignedRowClick,
  onUnassignedRowClick,
  onBulkUnassign,
  onBulkAssign,
  onDeleteUnassigned,
  hasMoreUnassigned,
  onLoadMoreUnassigned,
  loadingMoreUnassigned,
}: MonthlyLogTransactionsSectionProps) {
  const assignedSelectedCount = selectedAssigned.size;
  const unassignedSelectedCount = selectedUnassigned.size;

  return (
    <section className="space-y-6">
      <TransactionActionBar
        scopeFieldId={scopeFieldId}
        transactionScope={transactionScope}
        onScopeChange={onScopeChange}
        hasActiveLease={hasActiveLease}
        supportsUnitTransactions={supportsUnitTransactions}
        transactionMode={transactionMode}
        onTransactionModeChange={onTransactionModeChange}
        transactionModeMenuOpen={transactionModeMenuOpen}
        onTransactionModeMenuOpenChange={onTransactionModeMenuOpenChange}
        allowedModes={allowedModes}
        onAddTransaction={onAddTransaction}
        addTransactionDisabled={addTransactionDisabled}
        addTransactionDisabledReason={addTransactionDisabledReason}
      />

      <TransactionTabs
        assignedTransactions={assignedTransactions}
        unassignedTransactions={unassignedTransactions}
        assignedSearch={assignedSearch}
        onAssignedSearchChange={onAssignedSearchChange}
        unassignedSearch={unassignedSearch}
        onUnassignedSearchChange={onUnassignedSearchChange}
        loadingAssigned={loadingAssigned}
        loadingUnassigned={loadingUnassigned}
        selectedAssigned={selectedAssigned}
        selectedUnassigned={selectedUnassigned}
        onToggleAssignedSelection={onToggleAssignedSelection}
        onToggleAllAssigned={onToggleAllAssigned}
        onToggleUnassignedSelection={onToggleUnassignedSelection}
        onToggleAllUnassigned={onToggleAllUnassigned}
        onAssignedRowClick={onAssignedRowClick}
        onUnassignedRowClick={onUnassignedRowClick}
        assignedStickyActions={
          assignedSelectedCount > 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge
                variant="outline"
                className="border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700"
              >
                {assignedSelectedCount} selected
              </Badge>
              <Button type="button" size="sm" variant="outline" onClick={onBulkUnassign}>
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
              <Button type="button" size="sm" variant="outline" onClick={onBulkAssign}>
                Assign
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={onDeleteUnassigned}
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
        hasMoreUnassigned={hasMoreUnassigned}
        onLoadMoreUnassigned={onLoadMoreUnassigned}
        loadingMoreUnassigned={loadingMoreUnassigned}
      />
    </section>
  );
}

const MonthlyLogTransactionsSection = memo(MonthlyLogTransactionsSectionComponent);

export default MonthlyLogTransactionsSection;
