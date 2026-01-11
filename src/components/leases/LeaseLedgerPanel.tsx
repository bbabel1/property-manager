'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import TransactionDetailShell from '@/components/transactions/TransactionDetailShell';
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
import DestructiveActionModal from '@/components/common/DestructiveActionModal';

type LedgerDetailLine = {
  Amount?: unknown;
  GLAccount?: { Name?: string | null } | null;
  Id?: string | number | null;
};

type LedgerDetail = BuildiumLeaseTransaction & {
  Lines?: LedgerDetailLine[];
  Journal?: { Lines?: LedgerDetailLine[] } | null;
  PaymentDetail?: {
    Payee?: { Name?: string | null } | null;
    IsInternalTransaction?: boolean | null;
    InternalTransactionStatus?: { IsPending?: boolean | null } | null;
  } | null;
  TransactionTypeEnum?: string | null;
  TransactionType?: string | null;
  Memo?: string | null;
  Description?: string | null;
  CheckNumber?: string | null;
  ReferenceNumber?: string | null;
  reference_number?: string | null;
  UnitNumber?: string | null;
  TotalAmount?: number | null;
  Amount?: number | null;
  Id?: string | number | null;
};

type LedgerRow = {
  id: string;
  date: string;
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
  tenantOptions?: LeaseTenantOption[];
  accountOptions: LeaseAccountOption[];
  leaseSummary: {
    propertyUnit?: string | null;
    tenants?: string | null;
  };
  errorMessage?: string | null;
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
}: LeaseLedgerPanelProps) {
  const router = useRouter();
  const detailRequestIdRef = useRef(0);
  const [mode, setMode] = useState<'none' | 'deposit' | 'edit'>('none');
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
    | { status: 'ready'; row: LedgerRow; detail: LedgerDetail }
  >({ status: 'idle', row: null });
  const [pendingDeleteRow, setPendingDeleteRow] = useState<LedgerRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      { label: 'Deposits held', value: Math.abs(balances.depositsHeld) },
    ],
    [balances],
  );

  const buildReturnTo = () =>
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : `/leases/${leaseId}?tab=financials`;

  const buildAddPaymentHref = () => {
    const params = new URLSearchParams();
    const returnTo = buildReturnTo();
    if (returnTo) params.set('returnTo', returnTo);
    const defaultAmount = balances?.balance && balances.balance > 0 ? balances.balance : null;
    const defaultAccountId =
      Array.isArray(accountOptions) && accountOptions.length > 0
        ? String(accountOptions[0].id)
        : null;
    if (defaultAmount) params.set('amount', String(defaultAmount));
    if (defaultAccountId) params.set('account', defaultAccountId);
    const qs = params.toString();
    return `/leases/${leaseId}/add-payment${qs ? `?${qs}` : ''}`;
  };

  useEffect(() => {
    const returnTo = buildReturnTo();
    const withReturn = (base: string) =>
      returnTo ? `${base}?returnTo=${encodeURIComponent(returnTo)}` : base;
    const targets = [
      buildAddPaymentHref(),
      withReturn(`/leases/${leaseId}/add-charge`),
    ];
    targets.forEach((href) => {
      if (typeof router.prefetch === 'function') {
        try {
          const maybePromise = router.prefetch(href) as unknown;
          if (
            typeof maybePromise === 'object' &&
            maybePromise !== null &&
            typeof (maybePromise as { catch?: unknown }).catch === 'function'
          ) {
            (maybePromise as Promise<void>).catch(() => {});
          }
        } catch (_err) {
          // best-effort prefetch
        }
      }
    });
    // Safe to ignore returnTo because it is derived from window location
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId, router]);

  const pushWithReturn = (basePath: string) => {
    const returnTo = buildReturnTo();
    const params = new URLSearchParams();
    if (returnTo) params.set('returnTo', returnTo);
    const defaultAmount = balances?.balance && balances.balance > 0 ? balances.balance : null;
    const defaultAccountId =
      Array.isArray(accountOptions) && accountOptions.length > 0
        ? String(accountOptions[0].id)
        : null;
    if (defaultAmount) params.set('amount', String(defaultAmount));
    if (defaultAccountId) params.set('account', defaultAccountId);
    const qs = params.toString();
    const next = `${basePath}${qs ? `?${qs}` : ''}`;
    router.push(next);
  };

  const closeOverlay = () => {
    setMode('none');
    setEditingTransaction(null);
  };

  const closeDetailDialog = () => {
    detailRequestIdRef.current += 1; // cancel in-flight responses
    setDetailState({ status: 'idle', row: null });
  };

  const getTransactionReference = (row: LedgerRow) => {
    // Always prefer the local transaction UUID (row.id) for deletion
    // The row.id is set from tx.id or tx.Id in the lease page, which should be the database UUID
    // Only fall back to Buildium transaction ID if local ID is truly missing
    if (row.id && row.id.trim() !== '' && row.id !== '0') {
      return row.id;
    }
    // Fall back to Buildium transaction ID only if local ID is missing
    if (row.transactionId != null && row.transactionId !== 0) {
      return String(row.transactionId);
    }
    // Last resort
    return row.id || String(row.transactionId ?? '');
  };

  const getNumericTransactionId = (row: LedgerRow) => {
    const ref = row.transactionId ?? row.id;
    const numeric = Number(ref);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const isNegative = (value?: string | null) => {
    if (!value) return false;
    const trimmed = value.trim();
    return trimmed.startsWith('-') || trimmed.startsWith('(');
  };

  const rowIsCharge = (row: LedgerRow) => String(row.type || '').toLowerCase().includes('charge');

  const handleDeleteTransaction = useCallback(async () => {
    if (!pendingDeleteRow) return;
    const txParam = getTransactionReference(pendingDeleteRow);
    if (!txParam) return;
    setIsDeleting(true);
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
      toast.error(e instanceof Error ? e.message : 'Failed to delete transaction');
    } finally {
      setIsDeleting(false);
      setPendingDeleteRow(null);
    }
  }, [closeDetailDialog, leaseId, pendingDeleteRow, router]);

  const handleEditTransaction = (row: LedgerRow) => {
    const typeLabel = typeof row.type === 'string' ? row.type : '';
    const transactionIdRaw = getNumericTransactionId(row);
    if (!Number.isFinite(transactionIdRaw)) return;

    if (rowIsCharge(row)) {
      const current =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : `/leases/${leaseId}`;
      const target = `/leases/${leaseId}/edit-charge?transactionId=${transactionIdRaw}&returnTo=${encodeURIComponent(
        current,
      )}`;
      closeDetailDialog();
      router.push(target);
      return;
    }

    closeDetailDialog();
    setEditingTransaction({ id: Number(transactionIdRaw), typeLabel });
    setMode('edit');
  };

  const requestDeleteTransaction = (row: LedgerRow) => {
    setPendingDeleteRow(row);
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
        const detail = (payload?.data ?? payload) as LedgerDetail;
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

  const deriveSignedAmount = (row: LedgerRow | null, detail?: LedgerDetail | null) => {
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

    const { row } = detailState;
    const detail: LedgerDetail = detailState.detail;
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
      (detail as BuildiumLeaseTransaction & { ReferenceNumber?: string; reference_number?: string })
        ?.ReferenceNumber ??
      (detail as { ReferenceNumber?: string; reference_number?: string })?.reference_number ??
      null;
    const transactionId = detail?.Id ?? row.transactionId ?? row.id;
    const allocations =
      (Array.isArray(detail?.Lines) && detail?.Lines?.length ? detail.Lines : detail?.Journal?.Lines) ||
      [];
    const allocationList =
      allocations && allocations.length
        ? allocations
            .map((line) => {
              const amount = Number(line?.Amount ?? 0);
              if (!Number.isFinite(amount) || amount === 0) return null;
              const glName =
                typeof line?.GLAccount === 'object' && line?.GLAccount
                  ? line.GLAccount?.Name
                  : row.account || 'Account';
              return `${glName || 'Account'}: ${formatCurrency(Math.abs(amount))}`;
            })
            .filter(Boolean)
            .join(' • ')
        : null;

    const payeeName = detail?.PaymentDetail?.Payee?.Name ?? null;
    const unitNumber = detail?.UnitNumber ?? null;
    const isInternalTransfer = detail?.PaymentDetail?.IsInternalTransaction ?? false;
    const internalPending = detail?.PaymentDetail?.InternalTransactionStatus?.IsPending ?? false;

    const detailItems = [
      { label: 'Date', value: row.date },
      { label: 'Account', value: row.account || '—' },
      { label: 'Memo', value: memo || '—' },
      {
        label: 'Reference #',
        value: referenceNumber || '—',
        mono: true,
      },
      // Payee information (if available)
      ...(payeeName ? [{ label: 'Payee', value: payeeName }] : []),
      // Unit information (if available)
      ...(unitNumber ? [{ label: 'Unit', value: unitNumber }] : []),
      // Internal transaction status (if applicable)
      ...(isInternalTransfer
        ? [
            {
              label: 'Internal Transfer',
              value: internalPending ? 'Pending' : 'Completed',
            },
          ]
        : []),
    ];

    if (allocationList && allocationList.length) {
      detailItems.push({
        label: 'Allocations',
        value: allocationList,
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
          onDelete: () => requestDeleteTransaction(row),
          editDisabledReason: canEdit ? null : 'Only charge transactions can be edited here.',
          editLabel: 'Edit',
          deleteLabel: 'Delete',
        }}
      />
    );
  };

  const renderOverlayContent = () => {
    switch (mode) {
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
          <Button onClick={() => pushWithReturn(`/leases/${leaseId}/add-payment`)}>Receive payment</Button>
          <Button
            variant="outline"
            onClick={() => pushWithReturn(`/leases/${leaseId}/add-charge`)}
          >
            Enter charge
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionButton />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => pushWithReturn(`/leases/${leaseId}/add-credit`)}
              >
                Issue credit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => pushWithReturn(`/leases/${leaseId}/add-refund`)}
              >
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
                <TableCell colSpan={6} className="text-destructive py-6 text-center text-sm">
                  {errorMessage}
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => {
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
                    <TableCell
                      className={`text-right text-sm ${isNegative(row.displayAmount) ? 'text-destructive' : 'text-foreground'}`}
                    >
                      {row.displayAmount}
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm ${isNegative(row.balance) ? 'text-destructive' : 'text-foreground'}`}
                    >
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
                            onSelect={() => requestDeleteTransaction(row)}
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
      <DestructiveActionModal
        open={!!pendingDeleteRow}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDeleteRow(null);
          }
        }}
        title="Delete transaction?"
        description="This action cannot be undone."
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
        isProcessing={isDeleting}
        onConfirm={() => void handleDeleteTransaction()}
      />
    </div>
  );
}
