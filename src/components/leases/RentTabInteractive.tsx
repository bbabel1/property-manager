'use client';

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ActionButton from '@/components/ui/ActionButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Body, Heading, Label } from '@/ui/typography';
import DynamicOverlay from '@/components/ui/DynamicOverlay';
import RentScheduleForm, {
  RentScheduleFormDefaults,
  RentScheduleFormLeaseSummary,
} from '@/components/leases/RentScheduleForm';

type RentLogRowDisplay = {
  id: string;
  schedule: {
    id: string;
    start_date: string | null;
    end_date: string | null;
    rent_cycle: string | null;
    total_amount: number;
    status: string;
  };
  memo: string | null;
  postingLabel: string;
  statusLabel: string;
  statusVariant: 'default' | 'secondary' | 'outline';
  startLabel: string;
  endLabel: string;
  cycleLabel: string;
  amountLabel: string;
};

type CurrentCard = {
  rangeLabel: string;
  amountLabel: string;
  cycleLabel?: string | null;
  chargeLabel: string;
};

type UpcomingCard = {
  rangeLabel: string;
  amountLabel: string;
  cycleLabel?: string | null;
};

type RentTabInteractiveProps = {
  leaseId: number | string;
  currentCard: CurrentCard | null;
  upcomingCard: UpcomingCard | null;
  rentLog: RentLogRowDisplay[];
  rentCycleOptions: string[];
  rentStatusOptions: string[];
  leaseSummary: RentScheduleFormLeaseSummary;
  defaults?: RentScheduleFormDefaults;
  rentAccountOptions?: { value: string; label: string }[];
  recurringTransactionId?: string | number | null;
  recurringDefaults?: {
    memo?: string | null;
    posting_day?: number | null;
    posting_days_in_advance?: number | null;
    gl_account_id?: string | null;
  };
};

export default function RentTabInteractive({
  leaseId,
  currentCard,
  upcomingCard,
  rentLog,
  rentCycleOptions,
  rentStatusOptions,
  leaseSummary,
  defaults,
  rentAccountOptions,
  recurringTransactionId,
  recurringDefaults,
}: RentTabInteractiveProps) {
  const router = useRouter();
  const [isAdding, setIsAdding] = useState(false);
  const [editTarget, setEditTarget] = useState<RentLogRowDisplay | null>(null);
  const [overlayTop, setOverlayTop] = useState(0);
  const [overlayLeft, setOverlayLeft] = useState(0);
  const overlayActive = isAdding || Boolean(editTarget);

  const rentLogSummary = useMemo(() => {
    if (!rentLog.length) return 'No rent schedules yet';
    return `${rentLog.length} rent schedule${rentLog.length === 1 ? '' : 's'}`;
  }, [rentLog]);

  const leaseSummaryForForm = useMemo(() => leaseSummary, [leaseSummary]);

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

  const renderForm = () => {
    if (editTarget) {
      const scheduleDefaults: RentScheduleFormDefaults = {
        start_date: editTarget.schedule.start_date,
        end_date: editTarget.schedule.end_date,
        rent_cycle: editTarget.schedule.rent_cycle,
        total_amount: editTarget.schedule.total_amount,
        status: editTarget.schedule.status,
      };
      return (
        <RentScheduleForm
          leaseId={leaseId}
          rentScheduleId={editTarget.schedule.id}
          recurringTransactionId={recurringTransactionId}
          rentCycleOptions={rentCycleOptions}
          rentStatusOptions={rentStatusOptions}
          rentAccountOptions={rentAccountOptions}
          leaseSummary={leaseSummaryForForm}
          defaults={scheduleDefaults}
          recurringDefaults={recurringDefaults}
          onCancel={() => setEditTarget(null)}
          onSuccess={() => {
            setEditTarget(null);
            router.refresh();
          }}
        />
      );
    }

    return (
      <RentScheduleForm
        leaseId={leaseId}
        recurringTransactionId={recurringTransactionId}
        rentCycleOptions={rentCycleOptions}
        rentStatusOptions={rentStatusOptions}
        rentAccountOptions={rentAccountOptions}
        leaseSummary={leaseSummaryForForm}
        defaults={defaults}
        recurringDefaults={recurringDefaults}
        onCancel={() => setIsAdding(false)}
        onSuccess={() => {
          setIsAdding(false);
          router.refresh();
        }}
      />
    );
  };

  if (overlayActive) {
    return (
      <DynamicOverlay overlayTop={overlayTop} overlayLeft={overlayLeft}>
        {renderForm()}
      </DynamicOverlay>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 border shadow-sm">
          <CardContent className="flex h-full flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <Label as="p" size="xs" tone="muted" className="tracking-wide uppercase">
                  Current rent
                </Label>
                <Body size="xs" tone="muted" className="mt-1">
                  {currentCard?.rangeLabel ?? 'No current rent schedule recorded.'}
                </Body>
              </div>
              {currentCard ? <Badge variant="default">Current</Badge> : null}
            </div>
            {currentCard ? (
              <div className="space-y-1">
                <Heading as="p" size="h3">
                  {currentCard.amountLabel}{' '}
                  {currentCard.cycleLabel ? (
                    <Body as="span" tone="muted">
                      {currentCard.cycleLabel.toLowerCase()}
                    </Body>
                  ) : null}
                </Heading>
                <Body tone="muted">{currentCard.chargeLabel}</Body>
              </div>
            ) : (
              <Body tone="muted">No current rent schedule recorded.</Body>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 border shadow-sm">
          <CardContent className="flex h-full flex-col gap-4 p-6">
            <div className="flex items-start justify-between">
              <div>
                <Label as="p" size="xs" tone="muted" className="tracking-wide uppercase">
                  Upcoming rent
                </Label>
                <Body size="xs" tone="muted" className="mt-1">
                  {upcomingCard?.rangeLabel ?? 'No upcoming rent changes are scheduled.'}
                </Body>
              </div>
              {upcomingCard ? <Badge variant="secondary">Future</Badge> : null}
            </div>
            {upcomingCard ? (
              <div className="space-y-1">
                <Heading as="p" size="h4">
                  {upcomingCard.amountLabel}
                </Heading>
                <Body tone="muted">{upcomingCard.cycleLabel ?? '—'}</Body>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <Body as="span" tone="muted" className="text-center leading-relaxed">
                  No upcoming rent changes are scheduled.
                </Body>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-muted/10 border border-dashed shadow-none">
          <CardContent className="flex h-full flex-col items-start justify-between gap-4 p-6">
            <div>
              <Label as="p" size="xs" tone="muted" className="tracking-wide uppercase">
                Add a rent change
              </Label>
              <Body tone="muted" className="mt-2">
                Add a new future or past rent schedule to keep the rent roll accurate.
              </Body>
            </div>
            <Button onClick={() => setIsAdding(true)}>Add</Button>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Heading as="h3" size="h6">
            Rent log
          </Heading>
          <Body as="span" size="xs" tone="muted">
            {rentLogSummary}
          </Body>
        </div>
        <div className="border-border overflow-hidden rounded-lg border">
          <Table className="divide-border min-w-full divide-y">
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">
                  <Label as="span" size="xs">
                    Status
                  </Label>
                </TableHead>
                <TableHead>
                  <Label as="span" size="xs">
                    Start date
                  </Label>
                </TableHead>
              <TableHead>
                <Label as="span" size="xs">
                  End date
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs">
                  Cycle
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs">
                  Posting
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs">
                  Memo
                </Label>
              </TableHead>
              <TableHead className="text-right">
                <Label as="span" size="xs">
                  Amount
                </Label>
              </TableHead>
              <TableHead className="w-16 text-right">
                <Label as="span" size="xs">
                  Actions
                </Label>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-border bg-card divide-y">
            {rentLog.length ? (
              rentLog.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Badge variant={row.statusVariant} className="tracking-wide uppercase">
                      {row.statusLabel}
                    </Badge>
                  </TableCell>
                    <TableCell>
                      <Body as="span" size="sm">
                        {row.startLabel}
                      </Body>
                    </TableCell>
                    <TableCell>
                      <Body as="span" size="sm">
                        {row.endLabel}
                      </Body>
                    </TableCell>
                    <TableCell>
                      <Body as="span" size="sm">
                        {row.cycleLabel}
                      </Body>
                    </TableCell>
                    <TableCell>
                      <Body as="span" size="sm">
                        {row.postingLabel}
                      </Body>
                    </TableCell>
                    <TableCell>
                      <Body as="span" size="sm">
                        {row.memo || '—'}
                      </Body>
                    </TableCell>
                    <TableCell className="text-right">
                      <Body as="span" size="sm">
                        {row.amountLabel}
                      </Body>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <ActionButton aria-label="Rent schedule actions" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditTarget(row)}>
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center">
                    <Body tone="muted">No rent schedules recorded yet.</Body>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
