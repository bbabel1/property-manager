'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Body, Label } from '@/ui/typography';

type Application = {
  id: string;
  applied_amount: number;
  applied_at?: string | null;
  source_type?: string | null;
  source_transaction_id?: string | null;
  source?: {
    id?: string | null;
    transaction_type?: string | null;
    status?: string | null;
    total_amount?: number | null;
    payment_method?: string | null;
    is_reconciled?: boolean | null;
    date?: string | null;
    reference_number?: string | null;
    check_number?: string | null;
  } | null;
};

type Props = {
  billId: string;
  applications: Application[];
};

function formatCurrency(value?: number | null) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

export function BillApplicationsList({ billId, applications }: Props) {
  const [isDeleting, startTransition] = useTransition();

  const handleDelete = (id: string, isLocked: boolean) => {
    if (isLocked) {
      toast.error('This payment is reconciled and cannot be edited.');
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`/api/bills/${billId}/applications/${id}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const msg = body?.error || 'Failed to remove application';
          toast.error(msg);
        } else {
          toast.success('Application removed');
          window.location.reload();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to remove application');
      }
    });
  };

  return (
    <div className="rounded-md border border-border/70 bg-card">
      <Label as="div" size="sm" className="border-b px-4 py-3 font-semibold">
        Applications
      </Label>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Label as="span" size="sm">
                  Source
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="sm">
                  Type
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="sm">
                  Status
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="sm">
                  Applied
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="sm">
                  Date
                </Label>
              </TableHead>
              <TableHead className="text-right">
                <Label as="span" size="sm">
                  Amount
                </Label>
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-4 text-center">
                  <Body tone="muted" size="sm">
                    No applications yet.
                  </Body>
                </TableCell>
              </TableRow>
            ) : (
              applications.map((app) => {
                const source = app.source || {};
                const isReconciled = Boolean(source.is_reconciled);
                const status = source.status || '—';
                const typeLabel = app.source_type || source.transaction_type || 'payment';
                const displayRef =
                  source.reference_number ||
                  source.check_number ||
                  (source.id ? `#${source.id.slice(0, 6)}` : '—');
                return (
                  <TableRow key={app.id}>
                    <TableCell>
                      {source.id ? (
                        <Link href={`/transactions/${source.id}`} className="text-primary hover:underline">
                          {displayRef}
                        </Link>
                      ) : (
                        displayRef
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{typeLabel.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <Badge variant={isReconciled ? 'secondary' : 'outline'}>
                        {isReconciled ? 'Reconciled (locked)' : status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(app.applied_at)}</TableCell>
                    <TableCell>{formatDate(source.date)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(app.applied_amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isDeleting || isReconciled}
                        onClick={() => handleDelete(app.id, isReconciled)}
                        title={isReconciled ? 'This application is locked by reconciliation' : undefined}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
