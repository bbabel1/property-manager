'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/components/providers';
import type { AppRole } from '@/lib/auth/roles';

type PropertyOption = {
  id: string;
  label: string;
  buildiumPropertyId: number | null;
};

type PreviewTransaction = {
  buildiumId: number;
  buildiumDate: string | null;
  totalAmount: number;
  transactionType: string | null;
  memo: string | null;
  checkNumber: string | null;
  lastUpdated: string | null;
  status: 'matched' | 'mismatch' | 'missing';
  mismatches: string[];
  localTransactionId: string | null;
  buildiumPayload: Record<string, unknown>;
};

type PaginationMeta = {
  page?: number;
  totalPages?: number;
  totalItems?: number;
  limit?: number;
  offset?: number;
};

type PreviewResponse = {
  pagination?: PaginationMeta;
  summary: { total: number; matched: number; mismatch: number; missing: number };
  transactions: PreviewTransaction[];
};

type BuildiumTransactionsSyncButtonProps = {
  properties: PropertyOption[];
  selectedPropertyId?: string | null;
  startDate: string;
  endDate: string;
  basis: 'cash' | 'accrual';
};

const ADMIN_ROLES: AppRole[] = ['platform_admin', 'org_admin'];

const formatAmount = (value: number | null) =>
  typeof value === 'number'
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
      }).format(value)
    : '—';

const statusBadge = (status: PreviewTransaction['status']) => {
  switch (status) {
    case 'matched':
      return { label: 'Matched', variant: 'success' as const };
    case 'mismatch':
      return { label: 'Mismatch', variant: 'warning' as const };
    case 'missing':
      return { label: 'Missing', variant: 'danger' as const };
    default:
      return { label: status, variant: 'info' as const };
  }
};

export function BuildiumTransactionsSyncButton({
  properties,
  selectedPropertyId,
  startDate,
  endDate,
  basis,
}: BuildiumTransactionsSyncButtonProps) {
  const { user } = useAuth();
  const roles = useMemo(() => {
    const appMeta = (user?.app_metadata ?? {}) as Record<string, unknown>;
    const claims = (appMeta?.claims ?? {}) as Record<string, unknown>;
    const claimRoles =
      ((claims as { roles?: AppRole[] })?.roles ?? (appMeta as { roles?: AppRole[] })?.roles) || [];
    return Array.isArray(claimRoles) ? (claimRoles as AppRole[]) : [];
  }, [user]);
  const isAdmin = roles.some((role) => ADMIN_ROLES.includes(role));

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  );

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    // Reset preview if context changes
    setPreview(null);
    setSelectedIds(new Set());
    setMessage(null);
    setError(null);
  }, [selectedPropertyId, startDate, endDate]);

  if (!isAdmin) return null;

  const disableReason = (() => {
    if (!selectedProperty) return 'Select exactly one property to sync Buildium transactions.';
    if (!selectedProperty.buildiumPropertyId)
      return 'Selected property is missing a Buildium Property ID.';
    return null;
  })();

  const handleFetch = async () => {
    if (!selectedProperty) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const params = new URLSearchParams({
        propertyId: selectedProperty.id,
        startDate,
        endDate,
        limit: '200',
        basis,
      });
      const res = await fetch(`/api/buildium/general-ledger/transactions?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || !json?.success) {
        const errMsg =
          json?.error || 'Failed to load Buildium general ledger transactions for preview.';
        throw new Error(errMsg);
      }
      const data = json.data as PreviewResponse;
      setPreview(data);
      const defaultSelection = new Set<number>(
        (data.transactions || [])
          .filter((tx) => tx.status !== 'matched')
          .map((tx) => tx.buildiumId),
      );
      setSelectedIds(defaultSelection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Buildium transactions.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedProperty || !preview) return;
    const selectedTransactions = preview.transactions.filter((tx) =>
      selectedIds.has(tx.buildiumId),
    );
    if (!selectedTransactions.length) {
      setError('Select at least one transaction to sync.');
      return;
    }

    setSyncing(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/buildium/general-ledger/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          transactions: selectedTransactions.map((tx) => tx.buildiumPayload),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        const errMsg =
          json?.error ||
          json?.data?.failures?.[0]?.error ||
          'Failed to sync transactions into the database.';
        throw new Error(errMsg);
      }
      const updatedCount = json?.data?.updated ?? selectedTransactions.length;
      setMessage(`Updated ${updatedCount} transaction${updatedCount === 1 ? '' : 's'} from Buildium.`);
      await handleFetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelection = (buildiumId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(buildiumId)) next.delete(buildiumId);
      else next.add(buildiumId);
      return next;
    });
  };

  const selectAll = (predicate?: (tx: PreviewTransaction) => boolean) => {
    if (!preview) return;
    const ids = preview.transactions
      .filter((tx) => (predicate ? predicate(tx) : true))
      .map((tx) => tx.buildiumId);
    setSelectedIds(new Set(ids));
  };

  const renderBody = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" aria-hidden />
          <span className="text-muted-foreground ml-2 text-sm">Fetching from Buildium…</span>
        </div>
      );
    }

    if (!preview) {
      return (
        <div className="text-muted-foreground py-10 text-center text-sm">
          Run a preview to see Buildium transactions for this property and date range.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Total {preview.summary.total}</Badge>
            <Badge variant="success">
              Matched {preview.summary.matched}
            </Badge>
            <Badge variant="warning">
              Mismatch {preview.summary.mismatch}
            </Badge>
            <Badge variant="danger">
              Missing {preview.summary.missing}
            </Badge>
          </div>
          {preview.pagination ? (
            <span>
              Pages{' '}
              {preview.pagination.page != null && preview.pagination.totalPages != null
                ? `${preview.pagination.page} / ${preview.pagination.totalPages}`
                : 'n/a'}{' '}
              · Limit {preview.pagination.limit ?? '—'} · Offset {preview.pagination.offset ?? '—'}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => selectAll()}
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => selectAll((tx) => tx.status !== 'matched')}
            >
              Select missing & mismatches
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleFetch}
              disabled={loading}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button
              type="button"
              onClick={handleSync}
              disabled={syncing || !selectedIds.size || loading}
            >
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sync selected
            </Button>
          </div>
        </div>
        <Separator />
        <ScrollArea className="h-[420px] rounded-md border">
          <Table className="text-sm">
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow>
                <TableHead className="w-10">Select</TableHead>
                <TableHead>Buildium ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issues</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                    No transactions returned for this request.
                  </TableCell>
                </TableRow>
              ) : (
                preview.transactions.map((tx) => {
                  const status = statusBadge(tx.status);
                  return (
                    <TableRow key={tx.buildiumId} className="align-top">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(tx.buildiumId)}
                          onCheckedChange={() => toggleSelection(tx.buildiumId)}
                          aria-label={`Select Buildium transaction ${tx.buildiumId}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{tx.buildiumId}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{tx.buildiumDate ?? '—'}</span>
                          {tx.lastUpdated ? (
                            <span className="text-muted-foreground text-xs">
                              Updated {tx.lastUpdated}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{tx.transactionType ?? '—'}</span>
                          {tx.memo ? (
                            <span className="text-muted-foreground text-xs line-clamp-2">
                              {tx.memo}
                            </span>
                          ) : null}
                          {tx.checkNumber ? (
                            <span className="text-muted-foreground text-xs">
                              Check #{tx.checkNumber}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">{formatAmount(tx.totalAmount)}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="font-normal">
                          {status.label}
                        </Badge>
                        {tx.localTransactionId ? (
                          <div className="text-muted-foreground mt-1 text-[11px]">
                            Local ID {tx.localTransactionId.slice(0, 8)}…
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {tx.mismatches.length === 0 ? (
                          <span className="text-muted-foreground text-xs">—</span>
                        ) : (
                          <ul className="list-disc space-y-1 pl-4 text-xs">
                            {tx.mismatches.map((issue, idx) => (
                              <li key={idx} className="text-foreground">
                                {issue}
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={Boolean(disableReason)}
        title={disableReason || undefined}
        onClick={() => {
          if (disableReason) return;
          setOpen(true);
          void handleFetch();
        }}
      >
        Sync Buildium GL
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Buildium General Ledger Sync</DialogTitle>
            <DialogDescription>
              {selectedProperty ? (
                <span>
                  {selectedProperty.label} · {startDate} → {endDate}
                </span>
              ) : (
                'Select a property to preview Buildium transactions.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Sync preview failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {message ? (
              <Alert>
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}
            {renderBody()}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BuildiumTransactionsSyncButton;
