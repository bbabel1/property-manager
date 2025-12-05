'use client';

import { memo } from 'react';

import DestructiveActionModal from '@/components/common/DestructiveActionModal';
import JournalEntryDetailDialog from '@/components/monthly-logs/JournalEntryDetailDialog';
import MonthlyLogTransactionOverlay, {
  type TransactionMode,
} from '@/components/monthly-logs/MonthlyLogTransactionOverlay';
import TransactionDetailDialog from '@/components/monthly-logs/TransactionDetailDialog';
import type { LeaseTenantOption } from '@/components/leases/types';
import { formatCurrency, formatDate } from '@/lib/transactions/formatting';
import type { MonthlyLogFinancialSummary, MonthlyLogTransaction } from '@/types/monthly-log';

type MonthlyLogActiveLease = {
  id: number;
  lease_from_date: string;
  lease_to_date: string | null;
  rent_amount: number | null;
  tenant_names: string[];
  total_charges: number;
} | null;

interface MonthlyLogDialogsProps {
  transactionOverlayOpen: boolean;
  transactionMode: TransactionMode;
  onTransactionModeChange: (mode: TransactionMode) => void;
  onCloseOverlay: () => void;
  allowedModes: TransactionMode[];
  leaseId: string;
  leaseSummary: string[];
  tenantOptions: LeaseTenantOption[];
  hasActiveLease: boolean;
  monthlyLogId: string;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitLabel: string | null;
  orgId: string | null;
  addAssignedTransaction: (transaction: MonthlyLogTransaction) => void;
  removeAssignedTransaction: (transactionId: string) => void;
  refetchAssigned: () => Promise<void>;
  refetchFinancial: () => Promise<void>;
  financialSummary: MonthlyLogFinancialSummary | null;
  periodStart: string;
  activeLease: MonthlyLogActiveLease;
  transactionDetailDialogOpen: boolean;
  onTransactionDetailDialogOpenChange: (open: boolean) => void;
  selectedTransactionDetail: MonthlyLogTransaction | null;
  selectedTransactionScope: 'assigned' | 'unassigned' | null;
  onDeleteTransaction: () => void;
  onEditTransaction: () => void;
  editDisabledReason: string | null;
  confirmState: {
    open: boolean;
    title: string;
    description: string;
  };
  confirmProcessing: boolean;
  onConfirmDelete: () => void;
  onConfirmDialogToggle: (open: boolean) => void;
  onJournalEntrySaved: () => void;
}

function MonthlyLogDialogsComponent({
  transactionOverlayOpen,
  transactionMode,
  onTransactionModeChange,
  onCloseOverlay,
  allowedModes,
  leaseId,
  leaseSummary,
  tenantOptions,
  hasActiveLease,
  monthlyLogId,
  propertyId,
  propertyName,
  unitId,
  unitLabel,
  orgId,
  addAssignedTransaction,
  removeAssignedTransaction,
  refetchAssigned,
  refetchFinancial,
  financialSummary,
  periodStart,
  activeLease,
  transactionDetailDialogOpen,
  onTransactionDetailDialogOpenChange,
  selectedTransactionDetail,
  selectedTransactionScope,
  onDeleteTransaction,
  onEditTransaction,
  editDisabledReason,
  confirmState,
  confirmProcessing,
  onConfirmDelete,
  onConfirmDialogToggle,
  onJournalEntrySaved,
}: MonthlyLogDialogsProps) {
  return (
    <>
      {transactionOverlayOpen ? (
        <MonthlyLogTransactionOverlay
          isOpen={transactionOverlayOpen}
          mode={transactionMode}
          onModeChange={onTransactionModeChange}
          onClose={onCloseOverlay}
          allowedModes={allowedModes}
          leaseId={leaseId}
          leaseSummary={leaseSummary}
          tenantOptions={tenantOptions}
          hasActiveLease={hasActiveLease}
          monthlyLogId={monthlyLogId}
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
          periodStart={periodStart}
          activeLease={activeLease}
        />
      ) : null}

      {selectedTransactionDetail?.transaction_type === 'GeneralJournalEntry' ? (
        <JournalEntryDetailDialog
          open={transactionDetailDialogOpen}
          onOpenChange={onTransactionDetailDialogOpenChange}
          transaction={selectedTransactionDetail}
          onSaved={onJournalEntrySaved}
        />
      ) : (
        <TransactionDetailDialog
          open={transactionDetailDialogOpen}
          onOpenChange={onTransactionDetailDialogOpenChange}
          transaction={selectedTransactionDetail}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          onEdit={onEditTransaction}
          onDelete={selectedTransactionScope ? onDeleteTransaction : undefined}
          editDisabledReason={editDisabledReason}
        />
      )}

      <DestructiveActionModal
        open={confirmState.open}
        onOpenChange={onConfirmDialogToggle}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="Delete"
        isProcessing={confirmProcessing}
        onConfirm={onConfirmDelete}
      />
    </>
  );
}

const MonthlyLogDialogs = memo(MonthlyLogDialogsComponent);

export default MonthlyLogDialogs;
