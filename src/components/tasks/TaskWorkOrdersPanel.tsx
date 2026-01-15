'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, ClipboardList, MapPin, User, Users } from 'lucide-react';

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
import { Body, Heading, Label } from '@/ui/typography';

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
  new: 'status-pill-warning',
  in_progress: 'status-pill-info',
  completed: 'status-pill-success',
  cancelled: 'status-pill-danger',
  on_hold: 'status-pill-warning',
};

const PRIORITY_DOT_STYLES: Record<WorkOrderListItem['priorityKey'], string> = {
  low: 'bg-muted-foreground',
  normal: 'bg-warning-600',
  high: 'bg-danger-500',
  urgent: 'bg-danger-700',
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
          <Body as="p" tone="muted" size="sm">
            No work orders linked to this task yet.
          </Body>
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
                  'status-pill capitalize',
                  STATUS_BADGE_STYLES[selected.statusKey],
                )}
              >
                {selected.statusLabel}
              </Badge>
              <Badge
                variant="outline"
                className="status-pill border-border bg-muted text-foreground"
              >
                {selected.priorityLabel}
              </Badge>
            </div>
            <Heading as="h2" size="h4" className="flex flex-wrap items-baseline gap-2">
              {selected.subject}
              <Body as="span" tone="muted" size="sm">
                {selected.reference}
              </Body>
            </Heading>
            <Body as="p" tone="muted" size="sm">
              Created {selected.createdAtLabel}
              {selected.createdRelativeLabel ? ` (${selected.createdRelativeLabel})` : ''}
              {' • '}Last updated {selected.updatedAtLabel}
              {selected.updatedRelativeLabel ? ` (${selected.updatedRelativeLabel})` : ''}
            </Body>
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
                <Heading as="h4" size="h6">
                  Details
                </Heading>
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
                  <CardTitle headingSize="h6">Bills</CardTitle>
                  <CardDescription bodySize="xs">
                    {selected.bills.length ? 'Linked bills' : 'No bills entered yet.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {selected.bills.length ? (
                    <ul className="space-y-2">
                      {selected.bills.map((bill) => (
                        <li key={bill.id}>
                          <Body as="span" size="sm">
                            <Link
                              href={`/bills/${bill.id}`}
                              className="text-primary hover:underline"
                            >
                              {bill.reference}
                            </Link>
                          </Body>
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
                  <CardTitle headingSize="h6">Contacts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div className="space-y-1">
                    <Label as="p" size="xs" tone="muted" className="uppercase tracking-wide">
                      Vendor
                    </Label>
                    <Label as="p" size="sm">
                      {selected.vendorName || '—'}
                    </Label>
                    <Label as="p" size="xs" tone="muted">
                      Vendor
                    </Label>
                  </div>
                  <div className="space-y-1">
                    <Label as="p" size="xs" tone="muted" className="uppercase tracking-wide">
                      Entry contacts
                    </Label>
                    <Label as="p" size="sm">
                      {selected.assignedTo || '—'}
                    </Label>
                    <Button variant="link" size="sm" className="px-0">Send email</Button>
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
              <div className="border-b border-border/60 bg-muted/40 px-4 py-3">
                <Label as="p" size="sm">
                  Parts and supplies - $0.00
                </Label>
              </div>
              <div className="overflow-auto">
                <Table className="min-w-[760px]">
                  <TableHeader className="[&_th]:px-4 [&_th]:py-3">
                    <TableRow className="bg-muted/20 uppercase tracking-wide">
                      <TableHead className="w-16">
                        <Label as="span" size="xs" tone="muted">
                          Qty
                        </Label>
                      </TableHead>
                      <TableHead>
                        <Label as="span" size="xs" tone="muted">
                          Account
                        </Label>
                      </TableHead>
                      <TableHead>
                        <Label as="span" size="xs" tone="muted">
                          Description
                        </Label>
                      </TableHead>
                      <TableHead className="w-32">
                        <Label as="span" size="xs" tone="muted">
                          Price
                        </Label>
                      </TableHead>
                      <TableHead className="w-32">
                        <Label as="span" size="xs" tone="muted">
                          Amount
                        </Label>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_td]:px-4 [&_td]:py-3">
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        <Body tone="muted" size="sm">
                          No parts added yet.
                        </Body>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-md border border-border/60">
              <div className="border-b border-border/60 bg-muted/40 px-4 py-3">
                <Label as="p" size="sm">
                  Labor
                </Label>
              </div>
              <div className="overflow-auto">
                <Table className="min-w-[760px]">
                  <TableHeader className="[&_th]:px-4 [&_th]:py-3">
                    <TableRow className="bg-muted/20 uppercase tracking-wide">
                      <TableHead>
                        <Label as="span" size="xs" tone="muted">
                          Work sessions
                        </Label>
                      </TableHead>
                      <TableHead>
                        <Label as="span" size="xs" tone="muted">
                          Total hours worked
                        </Label>
                      </TableHead>
                      <TableHead>
                        <Label as="span" size="xs" tone="muted">
                          Total labor cost
                        </Label>
                      </TableHead>
                      <TableHead>
                        <Label as="span" size="xs" tone="muted">
                          Actions
                        </Label>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_td]:px-4 [&_td]:py-3">
                    <TableRow>
                      <TableCell>
                        <Body size="sm">0</Body>
                      </TableCell>
                      <TableCell>
                        <Body size="sm">00:00:00</Body>
                      </TableCell>
                      <TableCell>
                        <Body size="sm">$0.00</Body>
                      </TableCell>
                      <TableCell>
                        <Body size="sm" className="text-primary">
                          Add work sessions
                        </Body>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            <Label as="div" size="sm" className="text-right">
              $0.00
            </Label>
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
        <div className="border-border/70 flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Label as="span" size="sm">
              Work orders
            </Label>
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
            <TableRow className="border-border/70 bg-muted/40 border-b uppercase tracking-widest">
              <TableHead>
                <Label as="span" size="xs" tone="muted">
                  Work order
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs" tone="muted">
                  Status
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs" tone="muted">
                  Priority
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs" tone="muted">
                  Due
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs" tone="muted">
                  Updated
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs" tone="muted">
                  Property / Unit
                </Label>
              </TableHead>
              <TableHead>
                <Label as="span" size="xs" tone="muted">
                  Vendor
                </Label>
              </TableHead>
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
                    <Label as="span" size="sm" className="text-primary">
                      {wo.subject}
                    </Label>
                    <Body as="span" tone="muted" size="xs">
                      {wo.reference}
                    </Body>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'status-pill capitalize',
                      STATUS_BADGE_STYLES[wo.statusKey],
                    )}
                  >
                    {wo.statusLabel}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('size-2.5 rounded-full', PRIORITY_DOT_STYLES[wo.priorityKey])}
                      aria-hidden
                    />
                    <Body as="span" size="sm">
                      {wo.priorityLabel}
                    </Body>
                  </div>
                </TableCell>
                <TableCell>
                  <Body size="sm">{wo.dueDateLabel}</Body>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <Body as="span" size="sm">
                      {wo.updatedAtLabel}
                    </Body>
                    <Body as="span" tone="muted" size="xs">
                      {wo.updatedRelativeLabel}
                    </Body>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <Body as="span" size="sm">
                      {wo.propertyName}
                    </Body>
                    <Body as="span" tone="muted" size="xs">
                      {wo.unitLabel || '—'}
                    </Body>
                  </div>
                </TableCell>
                <TableCell>
                  <Body size="sm">{wo.vendorName || '—'}</Body>
                </TableCell>
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
      <Label
        as="div"
        size="xs"
        tone="muted"
        className="flex items-center gap-2 uppercase tracking-wide"
      >
        <Icon className="size-4" aria-hidden />
        {label}
      </Label>
      <Body as="p" size="sm">
        {value || '—'}
      </Body>
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
      <Label as="p" size="xs" tone="muted" className="tracking-widest uppercase">
        {label}
      </Label>
      <Body as="p" size="sm" className="leading-6">
        {value || '—'}
      </Body>
    </div>
  );
}
