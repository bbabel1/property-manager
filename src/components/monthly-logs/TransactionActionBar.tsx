'use client';

import { ChevronDown, Check, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { TransactionMode } from './MonthlyLogTransactionOverlay';

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

interface TransactionActionBarProps {
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
}

export default function TransactionActionBar({
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
}: TransactionActionBarProps) {
  const transactionModeLabel = TRANSACTION_MODE_LABELS[transactionMode] ?? 'Transaction';

  return (
    <div className="space-y-3">
      <div className="flex flex-col flex-wrap items-start gap-3 sm:flex-row sm:items-center">
        {/* Scope Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-800">Scope:</span>
          <RadioGroup
            value={transactionScope}
            onValueChange={(value) => onScopeChange(value as 'lease' | 'unit')}
            className="flex items-center gap-3"
            aria-label="Transaction scope"
          >
            {hasActiveLease ? (
              <Label htmlFor={`${scopeFieldId}-lease`} className="cursor-pointer text-slate-800">
                <RadioGroupItem value="lease" id={`${scopeFieldId}-lease`} className="peer" />
                <span className="ml-2">Lease</span>
              </Label>
            ) : null}
            {supportsUnitTransactions ? (
              <Label htmlFor={`${scopeFieldId}-unit`} className="cursor-pointer text-slate-800">
                <RadioGroupItem value="unit" id={`${scopeFieldId}-unit`} className="peer" />
                <span className="ml-2">Unit</span>
              </Label>
            ) : null}
          </RadioGroup>
          {!hasActiveLease && !supportsUnitTransactions ? (
            <span className="text-sm text-slate-600">Unavailable</span>
          ) : null}
        </div>

        <div className="flex-1" />

        {/* Transaction Type Dropdown */}
        <DropdownMenu open={transactionModeMenuOpen} onOpenChange={onTransactionModeMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={addTransactionDisabled}
            >
              {transactionModeLabel}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {allowedModes.map((mode) => {
              const label = TRANSACTION_MODE_LABELS[mode] ?? mode;
              return (
                <DropdownMenuItem
                  key={mode}
                  onSelect={(event) => {
                    event.preventDefault();
                    onTransactionModeChange(mode);
                    onTransactionModeMenuOpenChange(false);
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

        {/* Add Button */}
        <Button
          type="button"
          size="sm"
          variant="default"
          className="gap-2"
          onClick={onAddTransaction}
          disabled={addTransactionDisabled}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add {transactionModeLabel.toLowerCase()}</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </div>

      {/* Info Messages */}
      {addTransactionDisabledReason ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <p>{addTransactionDisabledReason}</p>
        </div>
      ) : null}

      {(!hasActiveLease || !supportsUnitTransactions) && !addTransactionDisabledReason ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="space-y-1">
            {!hasActiveLease ? (
              <p>
                Lease transactions require an active lease. Link a lease from the unit's lease
                workspace.
              </p>
            ) : null}
            {!supportsUnitTransactions ? (
              <p>Unit transactions require this monthly log to be linked to a unit.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
