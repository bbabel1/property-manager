'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import TransactionDetailShell from '@/components/transactions/TransactionDetailShell';
import ReceivePaymentForm from '@/components/leases/ReceivePaymentForm';
import EnterChargeForm from '@/components/leases/EnterChargeForm';
import IssueCreditForm from '@/components/leases/IssueCreditForm';
import IssueRefundForm from '@/components/leases/IssueRefundForm';
import WithholdDepositForm from '@/components/leases/WithholdDepositForm';
import EditTransactionForm from '@/components/leases/EditTransactionForm';
import ActionButton from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import DynamicOverlay from '@/components/ui/DynamicOverlay';
import TransactionModalContent from '@/components/transactions/TransactionModalContent';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, getTransactionTypeLabel } from '@/lib/transactions/formatting';
import type { LeaseAccountOption, LeaseTenantOption } from '@/components/leases/types';
import type { BuildiumLeaseTransaction } from '@/types/buildium';

type LedgerRow = {
  id: string;
  date: string;
  invoice: string;
  account: string;
  type: string;
  memo: string | null;
  displayAmount: string;
  balance: string;
  transactionId?: string | number;
  amountRaw?: number;
  signedAmount?: number;
};

type LeaseLedgerPanelProps = {
  leaseId: number | string;
  rows: LedgerRow[];
  ledgerMatchesLabel: string;
  balances: {
    balance: number;
    prepayments: number;
    depositsHeld: number;
  };
  tenantOptions: LeaseTenantOption[];
  accountOptions: LeaseAccountOption[];
  leaseSummary: {
    propertyUnit?: string | null;
    tenants?: string | null;
  };
  errorMessage?: string | null;
  bankAccountOptions: Array<{ id: string; name: string }>;
};

export default function LeaseLedgerPanel({
  leaseId,
  rows,
  ledgerMatchesLabel,
  balances,
  tenantOptions,
  accountOptions,
  leaseSummary,
  errorMessage,
  bankAccountOptions,
}: LeaseLedgerPanelProps) {
  const router = useRouter();
  const detailRequestIdRef = useRef(0);
  const [mode, setMode] = useState<
    'none' | 'payment' | 'charge' | 'credit' | 'refund' | 'deposit' | 'edit'
  >('none');
  const [overlayTop, setOverlayTop] = useState(0);
  const [overlayLeft, setOverlayLeft] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState<{
    id: number;
    typeLabel?: string | null;
  } | null>(null);
  const [detailState, setDetailState] = useState<
    | { status: 'idle'; row: null }
    | { status: 'loading'; row: LedgerRow }
    | { status: 'error'; row: LedgerRow | null; message: string }
    | { status: 'ready'; row: LedgerRow; detail: BuildiumLeaseTransaction }
  >({ status: 'idle', row: null });

  const overlayActive = mode !== 'none';
  const detailOpen = detailState.status !== 'idle';

  useLayoutEffect(() => {
    if (!overlayActive) return;
    const update = () => {
      const anchor = document.querySelector('[data-lease-back-link]');
      if (anchor instanceof HTMLElement) {
        const rect = anchor.getBoundingClientRect();
        setOverlayTop(rect.bottom);
        anchor.style.visibility = 'hidden';
      } else {
        setOverlayTop(0);
      }

      const sidebarContainer = document.querySelector(
        '[data-slot="sidebar-container"]',
      ) as HTMLElement | null;
      const sidebarGap = document.querySelector('[data-slot="sidebar-gap"]') as HTMLElement | null;
      const sidebarRect =
        sidebarContainer?.getBoundingClientRect() || sidebarGap?.getBoundingClientRect();
      setOverlayLeft(sidebarRect ? sidebarRect.right : 0);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      const anchor = document.querySelector('[data-lease-back-link]') as HTMLElement | null;
      if (anchor) anchor.style.visibility = '';
    };
  }, [overlayActive]);

  useEffect(() => {
    if (!overlayActive) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [overlayActive]);

  const cards = useMemo(
    () => [
      { label: 'Current balance', value: balances.balance },
      { label: 'Prepayments', value: balances.prepayments },
      { label: 'Deposits held', value: balances.depositsHeld },
    ],
    [balances],
  );

  const closeOverlay = () => {
    setMode('none');
    setEditingTransaction(null);
  };

  const closeDetailDialog = () => {
    detailRequestIdRef.current += 1; // cancel in-flight responses
    setDetailState({ status: 'idle', row: null });
  };

  const getTransactionReference = (row: LedgerRow) =>
    (row.transactionId ?? row.id ?? '').toString();

  const getNumericTransactionId = (row: LedgerRow) => {
    const ref = row.transactionId ?? row.id;
    const numeric = Number(ref);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const rowIsCharge = (row: LedgerRow) => String(row.type || '').toLowerCase().includes('charge');

  const handleDeleteTransaction = async (row: LedgerRow) => {
    const txParam = getTransactionReference(row);
    if (!txParam) return;
    const confirmed =
      typeof window !== 'undefined'
        ? window.confirm('Delete this transaction? This cannot be undone.')
        : true;
    if (!confirmed) return;
    try {
      const res = await fetch(
        `/api/leases/${leaseId}/transactions/${encodeURIComponent(txParam)}`,
        { method: 'DELETE' },
      );
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to delete transaction');
      }
      closeDetailDialog();
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete transaction');
    }
  };

  const handleEditTransaction = (row: LedgerRow) => {
    const typeLabel = typeof row.type === 'string' ? row.type : '';
    const transactionIdRaw = getNumericTransactionId(row);
    if (!rowIsCharge(row) || !Number.isFinite(transactionIdRaw)) return;
    closeDetailDialog();
    setEditingTransaction({ id: Number(transactionIdRaw), typeLabel });
    setMode('edit');
  };

  const openDetailDialog = (row: LedgerRow) => {
    const txParam = getTransactionReference(row);
    if (!txParam) return;
    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;
    setDetailState({ status: 'loading', row });
    void (async () => {
      try {
        const res = await fetch(
          `/api/leases/${leaseId}/transactions/${encodeURIComponent(txParam)}`,
          { cache: 'no-store' },
        );
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error || 'Unable to load transaction');
        }
        const detail = (payload?.data ?? payload) as BuildiumLeaseTransaction;
        if (detailRequestIdRef.current !== requestId) return;
        setDetailState({ status: 'ready', row, detail });
      } catch (error) {
        if (detailRequestIdRef.current !== requestId) return;
        setDetailState({
          status: 'error',
          row,
          message: error instanceof Error ? error.message : 'Failed to load transaction',
        });
      }
    })();
  };

  const deriveSignedAmount = (row: LedgerRow | null, detail?: BuildiumLeaseTransaction | null) => {
    if (row?.signedAmount != null) return row.signedAmount;
    const raw = Number(detail?.TotalAmount ?? detail?.Amount ?? row?.amountRaw ?? 0) || 0;
    const type = String(
      detail?.TransactionTypeEnum ?? detail?.TransactionType ?? row?.type ?? '',
    ).toLowerCase();
    if (!raw) return 0;
    if (
      type.includes('payment') ||
      type.includes('credit') ||
      type.includes('refund') ||
      type.includes('adjustment')
    ) {
      return raw * -1;
    }
    return raw;
  };

  const renderDetailContent = () => {
    const AccessibleTitle = () => (
      <DialogTitle className="sr-only">Transaction details</DialogTitle>
    );

    if (detailState.status === 'loading' || detailState.status === 'idle') {
      return (
        <div className="space-y-3 px-6 py-8 text-sm text-muted-foreground">
          <AccessibleTitle />
          <p className="font-medium text-foreground">Loading transaction…</p>
          <p>This will only take a moment.</p>
        </div>
      );
    }

    if (detailState.status === 'error') {
      return (
        <div className="space-y-4 px-6 py-8">
          <AccessibleTitle />
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {detailState.message}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="ghost" onClick={closeDetailDialog}>
              Close
            </Button>
            {detailState.row ? (
              <Button type="button" onClick={() => openDetailDialog(detailState.row!)}>
                Retry
              </Button>
            ) : null}
          </div>
        </div>
      );
    }

    const { row, detail } = detailState;
    const normalizedType = (value?: string | null) =>
      (value || '').replace(/^Lease\s*/i, '').trim() || 'Transaction';
    const typeLabel = getTransactionTypeLabel(
      normalizedType(detail?.TransactionTypeEnum ?? detail?.TransactionType ?? row.type),
    );

    const signedAmount = deriveSignedAmount(row, detail);
    const amountTone = signedAmount < 0 ? 'negative' : signedAmount > 0 ? 'positive' : 'neutral';
    const amountLabel = formatCurrency(Math.abs(signedAmount || 0));
    const memo = detail?.Memo ?? detail?.Description ?? row.memo ?? '—';
    const referenceNumber =
      detail?.CheckNumber ??
      (detail as any)?.ReferenceNumber ??
      row.invoice ??
      null;
    const transactionId = detail?.Id ?? row.transactionId ?? row.id;
    const allocations =
      (Array.isArray(detail?.Lines) && detail?.Lines?.length ? detail.Lines : detail?.Journal?.Lines) ||
      [];
    const allocationList =
      allocations && allocations.length
        ? allocations
            .map((line, idx) => {
              const amount = Number(line?.Amount ?? 0);
              if (!Number.isFinite(amount) || amount === 0) return null;
              const glName =
                typeof line?.GLAccount === 'object' && line?.GLAccount
                  ? line.GLAccount?.Name
                  : row.account || 'Account';
              return (
                <div
                  key={
                    line && typeof line === 'object' && 'Id' in line && line?.Id != null
                      ? (line as { Id: number }).Id
                      : idx
                  }
                  className="flex items-center justify-between gap-2 text-xs text-slate-700"
                >
                  <span className="truncate">{glName || 'Account'}</span>
                  <span className="font-mono">{formatCurrency(Math.abs(amount))}</span>
                </div>
              );
            })
            .filter(Boolean)
        : null;

    const detailItems = [
      { label: 'Date', value: row.date },
      { label: 'Account', value: row.account || '—' },
      { label: 'Memo', value: memo || '—' },
      {
        label: 'Reference #',
        value: referenceNumber || '—',
        mono: true,
      },
    ];

    if (allocationList && allocationList.length) {
      detailItems.push({
        label: 'Allocations',
        value: <div className="space-y-1">{allocationList}</div>,
        mono: false,
      });
    }

    const canEdit = rowIsCharge(row) && Number.isFinite(getNumericTransactionId(row));

    return (
      <TransactionDetailShell
        title="Transaction Details"
        typeLabel={typeLabel}
        scopeLabel={[leaseSummary.propertyUnit, leaseSummary.tenants].filter(Boolean).join(' • ')}
        dateLabel={row.date}
        amountLabel={amountLabel}
        amountPrefix={amountTone === 'negative' ? '-' : amountTone === 'positive' ? '+' : ''}
        amountTone={amountTone}
        transactionId={transactionId ? String(transactionId) : undefined}
        referenceNumber={referenceNumber}
        detailItems={detailItems}
        actions={{
          hint: canEdit ? 'Edit or delete this transaction.' : 'Only charge transactions can be edited here.',
          onEdit: canEdit ? () => handleEditTransaction(row) : undefined,
          onDelete: () => handleDeleteTransaction(row),
          editDisabledReason: canEdit ? null : 'Only charge transactions can be edited here.',
          editLabel: 'Edit',
          deleteLabel: 'Delete',
        }}
      />
    );
  };

  const renderOverlayContent = () => {
    switch (mode) {
      case 'payment':
        return (
          <ReceivePaymentForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            tenants={tenantOptions}
            onCancel={closeOverlay}
            onSuccess={() => {
              closeOverlay();
              router.refresh();
            }}
          />
        );
      case 'charge':
        return (
          <EnterChargeForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            onCancel={closeOverlay}
            onSuccess={() => {
              closeOverlay();
              router.refresh();
            }}
          />
        );
      case 'credit':
        return (
          <IssueCreditForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            onCancel={closeOverlay}
            onSuccess={() => {
              closeOverlay();
              router.refresh();
            }}
          />
        );
      case 'refund':
        return (
          <IssueRefundForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            bankAccounts={bankAccountOptions}
            accounts={accountOptions}
            parties={tenantOptions}
            onCancel={closeOverlay}
            onSuccess={() => {
              closeOverlay();
              router.refresh();
            }}
          />
        );
      case 'deposit':
        return (
          <WithholdDepositForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            onCancel={closeOverlay}
            onSuccess={() => {
              closeOverlay();
              router.refresh();
            }}
          />
        );
      case 'edit':
        if (!editingTransaction) {
          closeOverlay();
          return null;
        }
        return (
          <EditTransactionForm
            leaseId={leaseId}
            transactionId={editingTransaction.id}
            accountOptions={accountOptions}
            leaseSummary={leaseSummary}
            initialTypeLabel={editingTransaction.typeLabel}
            onCancel={closeOverlay}
            onSaved={() => {
              closeOverlay();
              router.refresh();
            }}
          />
        );
      default:
        return null;
    }
  };

  if (overlayActive) {
    return (
      <DynamicOverlay overlayTop={overlayTop} overlayLeft={overlayLeft}>
        {renderOverlayContent()}
      </DynamicOverlay>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <div key={card.label} className="border-border bg-card rounded-lg border px-5 py-4">
              <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {card.label}
              </div>
              <div className="text-foreground mt-1 text-2xl font-semibold">
                ${card.value.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setMode('payment')}>Receive payment</Button>
          <Button variant="outline" onClick={() => setMode('charge')}>
            Enter charge
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionButton />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setMode('credit')}>
                Issue credit
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setMode('refund')}>
                Issue refund
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setMode('deposit')}>
                Withhold deposit
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" disabled>
                Remove late fees
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="text-muted-foreground text-sm lg:hidden">{ledgerMatchesLabel}</div>
      <div className="text-primary flex items-center justify-end gap-2 text-sm">
        <Button variant="link" className="px-0" disabled>
          Export
        </Button>
      </div>

      <div className="border-border overflow-hidden rounded-lg border">
        <Table className="divide-border min-w-full divide-y">
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Date</TableHead>
              <TableHead className="w-24">Invoice</TableHead>
              <TableHead className="w-40">Account</TableHead>
              <TableHead className="min-w-0 flex-1">Transaction</TableHead>
              <TableHead className="w-24 text-right">Amount</TableHead>
              <TableHead className="w-24 text-right">Balance</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-border bg-card divide-y">
            {errorMessage ? (
              <TableRow>
                <TableCell colSpan={7} className="text-destructive py-6 text-center text-sm">
                  {errorMessage}
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => {
                const typeLabel = typeof row.type === 'string' ? row.type : '';
                const canEdit = rowIsCharge(row) && Number.isFinite(getNumericTransactionId(row));
                const transactionIdRaw = getNumericTransactionId(row);
                return (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer hover:bg-muted/60"
                    onClick={(event) => {
                      const target = event.target as HTMLElement | null;
                      if (
                        target?.closest('button') ||
                        target?.closest('[role=\"menuitem\"]') ||
                        target?.closest('[data-row-link-ignore=\"true\"]')
                      ) {
                        return;
                      }
                      openDetailDialog(row);
                    }}
                  >
                    <TableCell className="text-foreground text-sm">{row.date}</TableCell>
                    <TableCell className="text-primary text-sm">{row.invoice}</TableCell>
                    <TableCell className="text-foreground text-sm">{row.account}</TableCell>
                    <TableCell className="min-w-0">
                      <div className="text-foreground flex items-center gap-2 text-sm">
                        <ArrowRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
                        <div className="flex min-w-0 flex-col">
                          <span className="font-medium">{row.type}</span>
                          {row.memo ? (
                            <span className="text-muted-foreground text-xs">{row.memo}</span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground text-right text-sm">
                      {row.displayAmount}
                    </TableCell>
                    <TableCell className="text-foreground text-right text-sm">
                      {row.balance}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <ActionButton
                            aria-label="Ledger actions"
                            data-row-link-ignore="true"
                            onClick={(event) => event.stopPropagation()}
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="min-w-[12rem]"
                          side="bottom"
                          sideOffset={6}
                        >
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer"
                            onSelect={() => handleDeleteTransaction(row)}
                          >
                            Delete
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer"
                            disabled={!canEdit || !Number.isFinite(transactionIdRaw)}
                            title={
                              !canEdit ? 'Only charge transactions can be edited here.' : undefined
                            }
                            onSelect={() => handleEditTransaction(row)}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" disabled>
                            Prepare invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-6 text-center text-sm">
                  No transactions recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Dialog open={detailOpen} onOpenChange={(open) => (!open ? closeDetailDialog() : undefined)}>
        <TransactionModalContent>{renderDetailContent()}</TransactionModalContent>
      </Dialog>
    </div>
  );
}
