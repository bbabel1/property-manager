'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus } from 'lucide-react';
import ActionButton from '@/components/ui/ActionButton';
import DynamicOverlay from '@/components/ui/DynamicOverlay';
import RecurringChargeForm from '@/components/leases/RecurringChargeForm';
import RecurringPaymentForm from '@/components/leases/RecurringPaymentForm';
import type { LeaseAccountOption, LeaseTenantOption } from '@/components/leases/types';
import { Body, Heading, Label } from '@/ui/typography';

export type RecurringRow = {
  id: string;
  nextDate: string;
  type: string;
  account: string;
  memo: string;
  frequency: string;
  duration: string;
  posting: string;
  amount: string;
};

type Props = {
  leaseId: number | string;
  rows: RecurringRow[];
  accounts: LeaseAccountOption[];
  leaseSummary: {
    propertyUnit?: string | null;
    tenants?: string | null;
  };
  tenants: LeaseTenantOption[];
};

export default function RecurringTransactionsPanel({
  leaseId,
  rows,
  accounts,
  leaseSummary,
  tenants,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'none' | 'charge' | 'payment'>('none');
  const [overlayTop, setOverlayTop] = useState(0);
  const [overlayLeft, setOverlayLeft] = useState(0);

  useLayoutEffect(() => {
    if (mode === 'none') return;
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
  }, [mode]);

  useEffect(() => {
    if (mode === 'none') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mode]);

  if (mode === 'charge' || mode === 'payment') {
    return (
      <DynamicOverlay overlayTop={overlayTop} overlayLeft={overlayLeft}>
        {mode === 'charge' ? (
          <RecurringChargeForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accounts}
            onCancel={() => setMode('none')}
            onSuccess={() => {
              setMode('none');
              router.refresh();
            }}
          />
        ) : (
          <RecurringPaymentForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accounts}
            tenants={tenants}
            onCancel={() => setMode('none')}
            onSuccess={() => {
              setMode('none');
              router.refresh();
            }}
          />
        )}
      </DynamicOverlay>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading as="h3" size="h5">
            Recurring transactions
          </Heading>
          <Body tone="muted" size="sm">
            Manage scheduled charges, payments, and credits for this lease.
          </Body>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" className="gap-2" onClick={() => setMode('charge')}>
            <Plus className="h-4 w-4" />
            Add recurring charge
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setMode('payment')}>
            Add recurring payment
          </Button>
          <Button variant="outline" className="gap-2" disabled>
            Add recurring credit
          </Button>
        </div>
      </div>

      <div className="border-border bg-card rounded-lg border shadow-sm">
        <div className="border-border text-muted-foreground flex items-center justify-between border-b px-5 py-3">
          <Body size="sm" tone="muted">
            {rows.length ? `${rows.length} match${rows.length === 1 ? '' : 'es'}` : 'No matches'}
          </Body>
          <Button variant="ghost" size="sm" className="h-8" disabled>
            Export
          </Button>
        </div>
        <Table className="divide-border min-w-full divide-y">
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">
                <Label as="span" size="xs">
                  Next date
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs">
                  Type
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs">
                  Account
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs">
                  Memo
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs">
                  Frequency
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs">
                  Duration
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs">
                  Posting day
                </Label>
              </TableHead>
              <TableHead className="w-32 text-right">
                <Label as="span" size="xs">
                  Amount
                </Label>
              </TableHead>
              <TableHead className="w-12 text-right">
                <Label as="span" size="xs">
                  Actions
                </Label>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-border divide-y">
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Body as="span" size="sm">
                      {row.nextDate}
                    </Body>
                  </TableCell>
                  <TableCell>
                    <Body as="span" size="sm">
                      {row.type}
                    </Body>
                  </TableCell>
                  <TableCell>
                    <Body as="span" size="sm">
                      {row.account}
                    </Body>
                  </TableCell>
                  <TableCell>
                    <Body as="span" size="sm">
                      {row.memo}
                    </Body>
                  </TableCell>
                  <TableCell>
                    <Body as="span" size="sm">
                      {row.frequency}
                    </Body>
                  </TableCell>
                  <TableCell>
                    <Body as="span" size="sm">
                      {row.duration}
                    </Body>
                  </TableCell>
                  <TableCell>
                    <Body as="span" size="sm">
                      {row.posting}
                    </Body>
                  </TableCell>
                  <TableCell className="text-right">
                    <Heading as="span" size="h6">
                      {row.amount}
                    </Heading>
                  </TableCell>
                  <TableCell className="text-right">
                    <ActionButton aria-label="Recurring transaction actions" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center">
                  <Body size="sm" tone="muted">
                    No recurring transactions have been set up yet.
                  </Body>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Body tone="muted" size="sm">
        Recurring transactions with crossed-out next dates will not post because they fall after the
        end of the current term.
      </Body>
    </div>
  );
}
