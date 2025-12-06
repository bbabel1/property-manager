'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, ClipboardList, MapPin, Phone, User, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/ui/utils';

export type WorkOrderListItem = {
  id: string;
  reference: string;
  subject: string;
  statusKey: 'new' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  statusLabel: string;
  priorityKey: 'low' | 'normal' | 'high' | 'urgent';
  priorityLabel: string;
  dueDateLabel: string;
  createdAtLabel: string;
  createdRelativeLabel: string;
  updatedAtLabel: string;
  updatedRelativeLabel: string;
  propertyName: string;
  unitLabel: string | null;
  vendorName: string | null;
  assignedTo: string | null;
  categoryLabel: string;
  description: string | null;
  notes: string | null;
  bills: { id: string; reference: string }[];
};

type TaskWorkOrdersPanelProps = {
  workOrders: WorkOrderListItem[];
  initialWorkOrderId?: string | null;
};

const STATUS_BADGE_STYLES: Record<WorkOrderListItem['statusKey'], string> = {
  new: 'border-[var(--color-warning-500)] bg-[var(--color-warning-50)] text-[var(--color-warning-600)]',
  in_progress: 'border-[var(--color-action-200)] bg-[var(--color-action-50)] text-[var(--color-action-700)]',
  completed: 'border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]',
  cancelled: 'border-[var(--color-gray-300)] bg-[var(--color-gray-50)] text-[var(--color-gray-600)]',
  on_hold: 'border-[var(--color-gray-300)] bg-[var(--color-gray-50)] text-[var(--color-gray-700)]',
};

const PRIORITY_DOT_STYLES: Record<WorkOrderListItem['priorityKey'], string> = {
  low: 'bg-[var(--color-gray-400)]',
  normal: 'bg-[var(--color-warning-600)]',
  high: 'bg-[var(--color-danger-500)]',
  urgent: 'bg-[var(--color-danger-700)]',
};

export default function TaskWorkOrdersPanel({ workOrders, initialWorkOrderId }: TaskWorkOrdersPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialWorkOrderId || null);
  const selected = useMemo(
    () => workOrders.find((wo) => wo.id === selectedId) || null,
    [selectedId, workOrders],
  );

  if (!workOrders.length) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-6">
          <p className="text-muted-foreground text-sm">No work orders linked to this task yet.</p>
        </CardContent>
      </Card>
    );
  }

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="px-2"
                onClick={() => setSelectedId(null)}
              >
                <ArrowLeft className="mr-1 size-4" aria-hidden />
                All work orders
              </Button>
              <Badge
                variant="outline"
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold capitalize',
                  STATUS_BADGE_STYLES[selected.statusKey],
                )}
              >
                {selected.statusLabel}
              </Badge>
              <Badge
                variant="outline"
                className="border-[var(--color-gray-200)] bg-[var(--color-gray-50)] text-foreground rounded-full px-3 py-1 text-xs font-semibold"
              >
                {selected.priorityLabel}
              </Badge>
            </div>
            <h2 className="text-foreground text-xl font-semibold leading-tight">
              {selected.subject}{' '}
              <span className="text-muted-foreground text-sm font-normal">{selected.reference}</span>
            </h2>
            <p className="text-muted-foreground text-sm">
              Created {selected.createdAtLabel}
              {selected.createdRelativeLabel ? ` (${selected.createdRelativeLabel})` : ''}
              {' • '}Last updated {selected.updatedAtLabel}
              {selected.updatedRelativeLabel ? ` (${selected.updatedRelativeLabel})` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="border-border/70">
              Edit details
            </Button>
            <Button variant="outline" size="sm" className="border-border/70">
              Enter bill
            </Button>
          </div>
        </div>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Work order overview</CardTitle>
            <CardDescription>Key details, vendor info, and notes.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 p-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <DetailItem icon={ClipboardList} label="Category" value={selected.categoryLabel} />
                <DetailItem icon={CalendarDays} label="Due date" value={selected.dueDateLabel} />
                <DetailItem icon={Users} label="Assigned to" value={selected.assignedTo || '—'} />
                <DetailItem icon={MapPin} label="Property" value={selected.propertyName} />
                <DetailItem icon={MapPin} label="Unit" value={selected.unitLabel || '—'} />
                <DetailItem icon={User} label="Vendor" value={selected.vendorName || '—'} />
              </div>
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
                <h4 className="text-foreground text-sm font-semibold">Details</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailText label="Entry details" value={selected.description || 'No entry details provided.'} />
                  <DetailText label="Work to be performed" value={selected.notes || 'No work description provided.'} />
                </div>
                <DetailText label="Vendor notes" value={selected.notes || 'No vendor notes provided.'} />
              </div>
            </div>
            <div className="space-y-4">
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="border-b border-border/70 pb-3">
                  <CardTitle className="text-sm">Bills</CardTitle>
                  <CardDescription className="text-xs">
                    {selected.bills.length ? 'Linked bills' : 'No bills entered yet.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {selected.bills.length ? (
                    <ul className="space-y-2 text-sm">
                      {selected.bills.map((bill) => (
                        <li key={bill.id}>
                          <Link
                            href={`/bills/${bill.id}`}
                            className="text-primary hover:underline"
                          >
                            {bill.reference}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Button variant="link" className="px-0">Enter bill</Button>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/70 shadow-sm">
                <CardHeader className="border-b border-border/70 pb-3">
                  <CardTitle className="text-sm">Contacts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Vendor</p>
                    <p className="text-foreground text-sm font-semibold">{selected.vendorName || '—'}</p>
                    <p className="text-muted-foreground text-xs">Vendor</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">Entry contacts</p>
                    <p className="text-foreground text-sm font-semibold">
                      {selected.assignedTo || '—'}
                    </p>
                    <Button variant="link" className="px-0 text-xs">Send email</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Files</CardTitle>
            <CardDescription>No files added yet.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Button variant="ghost" size="sm" className="px-0">+ Add files</Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Parts and labor</CardTitle>
            <CardDescription>Track material and labor totals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <div className="rounded-md border border-border/60">
              <div className="border-b border-border/60 bg-muted/40 px-4 py-3 text-sm font-semibold">
                Parts and supplies - $0.00
              </div>
              <div className="overflow-auto">
                <Table className="min-w-[760px]">
                  <TableHeader className="[&_th]:px-4 [&_th]:py-3">
                    <TableRow className="bg-muted/20 text-muted-foreground text-xs uppercase tracking-wide">
                      <TableHead className="w-16">Qty</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-32">Price</TableHead>
                      <TableHead className="w-32">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_td]:px-4 [&_td]:py-3">
                    <TableRow>
                      <TableCell colSpan={5} className="text-muted-foreground text-center text-sm">
                        No parts added yet.
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-md border border-border/60">
              <div className="border-b border-border/60 bg-muted/40 px-4 py-3 text-sm font-semibold">
                Labor
              </div>
              <div className="overflow-auto">
                <Table className="min-w-[760px]">
                  <TableHeader className="[&_th]:px-4 [&_th]:py-3">
                    <TableRow className="bg-muted/20 text-muted-foreground text-xs uppercase tracking-wide">
                      <TableHead>Work sessions</TableHead>
                      <TableHead>Total hours worked</TableHead>
                      <TableHead>Total labor cost</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_td]:px-4 [&_td]:py-3">
                    <TableRow>
                      <TableCell className="text-sm">0</TableCell>
                      <TableCell className="text-sm">00:00:00</TableCell>
                      <TableCell className="text-sm">$0.00</TableCell>
                      <TableCell className="text-sm text-primary">Add work sessions</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="text-right text-sm font-semibold">$0.00</div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Linked work orders</CardTitle>
            <CardDescription>No linked work orders yet.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Button variant="link" className="px-0">Link work orders</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-0">
        <div className="border-border/70 flex items-center justify-between border-b px-5 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-foreground font-medium">Work orders</span>
            <Badge variant="outline" className="border-border/60 bg-muted/50">
              {workOrders.length}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            Export
          </Button>
        </div>
        <Table className="min-w-[960px]">
          <TableHeader className="[&_th]:px-5 [&_th]:py-3">
            <TableRow className="border-border/70 bg-muted/40 text-muted-foreground border-b text-[11px] font-semibold uppercase tracking-widest">
              <TableHead>Work order</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Property / Unit</TableHead>
              <TableHead>Vendor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_td]:px-5 [&_td]:py-4">
            {workOrders.map((wo) => (
              <TableRow
                key={wo.id}
                className="border-border/70 cursor-pointer border-b transition-colors hover:bg-muted/30 last:border-0"
                onClick={() => setSelectedId(wo.id)}
              >
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-primary font-medium leading-5">{wo.subject}</span>
                    <span className="text-muted-foreground text-xs">{wo.reference}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium capitalize',
                      STATUS_BADGE_STYLES[wo.statusKey],
                    )}
                  >
                    {wo.statusLabel}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={cn('size-2.5 rounded-full', PRIORITY_DOT_STYLES[wo.priorityKey])}
                      aria-hidden
                    />
                    {wo.priorityLabel}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{wo.dueDateLabel}</TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-col">
                    <span>{wo.updatedAtLabel}</span>
                    <span className="text-muted-foreground text-xs">{wo.updatedRelativeLabel}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div className="flex flex-col">
                    <span>{wo.propertyName}</span>
                    <span className="text-muted-foreground text-xs">{wo.unitLabel || '—'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{wo.vendorName || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type DetailItemProps = {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: string | null;
};

function DetailItem({ icon: Icon, label, value }: DetailItemProps) {
  return (
    <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {label}
      </div>
      <p className="text-foreground text-sm">{value || '—'}</p>
    </div>
  );
}

type DetailTextProps = {
  label: string;
  value: string | null;
};

function DetailText({ label, value }: DetailTextProps) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs tracking-widest uppercase">{label}</p>
      <p className="text-foreground text-sm leading-6">{value || '—'}</p>
    </div>
  );
}
