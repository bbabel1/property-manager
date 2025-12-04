'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import TransactionTable from './TransactionTable';
import type { MonthlyLogTransaction } from '@/types/monthly-log';

interface TransactionTabsProps {
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
  assignedStickyActions: React.ReactNode;
  unassignedStickyActions: React.ReactNode;
  hasMoreUnassigned?: boolean;
  onLoadMoreUnassigned?: () => void;
  loadingMoreUnassigned?: boolean;
}

export default function TransactionTabs({
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
  assignedStickyActions,
  unassignedStickyActions,
  hasMoreUnassigned,
  onLoadMoreUnassigned,
  loadingMoreUnassigned,
}: TransactionTabsProps) {
  const filterTransactions = (
    transactions: MonthlyLogTransaction[],
    search: string,
  ): MonthlyLogTransaction[] => {
    if (!transactions.length) return [];
    const searchLower = search.trim().toLowerCase();
    if (!searchLower) return transactions;
    return transactions.filter((transaction) => {
      const fields = [
        transaction.memo,
        transaction.reference_number,
        transaction.transaction_type,
        transaction.account_name,
      ]
        .filter((field): field is string => Boolean(field))
        .map((field) => field.toLowerCase());
      return fields.some((field) => field.includes(searchLower));
    });
  };

  const filteredAssigned = filterTransactions(assignedTransactions, assignedSearch);
  const filteredUnassigned = filterTransactions(unassignedTransactions, unassignedSearch);

  return (
    <Tabs defaultValue="assigned" className="w-full">
      <TabsList className="bg-muted inline-flex h-9 items-center gap-1 rounded-xl p-1">
        <TabsTrigger
          value="assigned"
          className="group text-muted-foreground hover:text-foreground focus-visible:ring-ring data-[state=active]:bg-card data-[state=active]:text-foreground relative inline-flex h-7 flex-none items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none data-[state=active]:shadow-sm"
        >
          <span>Assigned</span>
          <span className="bg-muted text-muted-foreground group-data-[state=active]:bg-muted/80 group-data-[state=active]:text-foreground inline-flex min-w-[20px] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] leading-none font-medium transition-colors">
            {assignedTransactions.length}
          </span>
        </TabsTrigger>
        <TabsTrigger
          value="unassigned"
          className="group text-muted-foreground hover:text-foreground focus-visible:ring-ring data-[state=active]:bg-card data-[state=active]:text-foreground relative inline-flex h-7 flex-none items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none data-[state=active]:shadow-sm"
        >
          <span>Unassigned</span>
          <span className="bg-muted text-muted-foreground group-data-[state=active]:bg-muted/80 group-data-[state=active]:text-foreground inline-flex min-w-[20px] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] leading-none font-medium transition-colors">
            {unassignedTransactions.length}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="assigned" className="mt-4 space-y-4">
        <div className="flex flex-col flex-wrap items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-slate-900">Assigned transactions</h3>
            <p className="text-sm text-slate-600">
              Review current assignments and unassign if needed.
            </p>
          </div>
          <div className="relative w-full sm:w-[200px] md:w-[240px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <Input
              value={assignedSearch}
              onChange={(event) => onAssignedSearchChange(event.target.value)}
              placeholder="Search transactions..."
              className="h-10 w-full rounded-xl pl-9 text-sm"
            />
          </div>
        </div>
        <TransactionTable
          transactions={filteredAssigned}
          loading={loadingAssigned}
          selectedIds={selectedAssigned}
          onToggleSelection={onToggleAssignedSelection}
          onToggleAll={onToggleAllAssigned}
          onRowClick={onAssignedRowClick}
          stickyActions={assignedStickyActions}
          emptyTitle="No transactions assigned yet."
          emptyDescription="Assign or create transactions to see them in this list."
        />
      </TabsContent>

      <TabsContent value="unassigned" className="mt-4 space-y-4">
        <div className="flex flex-col flex-wrap items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-slate-900">Unassigned transactions</h3>
            <p className="text-sm text-slate-600">Assign transactions directly from this list.</p>
          </div>
          <div className="relative w-full sm:w-[200px] md:w-[240px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-600" />
            <Input
              value={unassignedSearch}
              onChange={(event) => onUnassignedSearchChange(event.target.value)}
              placeholder="Search memo or reference"
              className="h-10 w-full rounded-xl pl-9 text-sm"
            />
          </div>
        </div>
        <TransactionTable
          transactions={filteredUnassigned}
          loading={loadingUnassigned}
          selectedIds={selectedUnassigned}
          onToggleSelection={onToggleUnassignedSelection}
          onToggleAll={onToggleAllUnassigned}
          onRowClick={onUnassignedRowClick}
          stickyActions={unassignedStickyActions}
          emptyTitle="No transactions available."
          emptyDescription="New transactions will appear here when they match this scope."
        />
        {hasMoreUnassigned && onLoadMoreUnassigned ? (
          <div className="flex justify-center border-t border-slate-300 pt-4">
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
      </TabsContent>
    </Tabs>
  );
}
