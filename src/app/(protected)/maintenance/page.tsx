import Link from 'next/link';
import { CircleHelp, Download, MoreHorizontal, ChevronDown } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { supabase, supabaseAdmin } from '@/lib/db';
import type { Database } from '@/types/database';
import { Body, Heading, Label } from '@/ui/typography';

type WorkOrderStatus = 'New' | 'In progress' | 'Completed' | 'Cancelled';
type WorkOrderPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];
type UnitRow = Database['public']['Tables']['units']['Row'];
type ContactRow = Database['public']['Tables']['contacts']['Row'];

type UIWorkOrder = {
  id: string;
  taskId: string | null;
  title: string;
  requestType: string;
  unit: string;
  propertyName: string;
  updatedAt: string;
  updatedRelative: string;
  age: string;
  status: WorkOrderStatus;
  dueDate: string;
  assignedTo: string;
  priority: WorkOrderPriority;
  vendor: string;
  billTotal: string;
  billStatus: string;
};

const STATUS_BADGE_STYLES: Record<WorkOrderStatus, string> = {
  New: 'status-pill-warning',
  'In progress': 'status-pill-info',
  Completed: 'status-pill-success',
  Cancelled: 'status-pill-danger',
};

const PRIORITY_DOT_STYLES: Record<WorkOrderPriority, string> = {
  High: 'bg-danger-500',
  Normal: 'bg-warning-600',
  Low: 'bg-muted-foreground',
  Urgent: 'bg-danger-700',
};

const TASK_KIND_LABELS: Record<NonNullable<TaskRow['task_kind']>, string> = {
  owner: 'Rental owner request',
  resident: 'Resident request',
  contact: 'Contact request',
  todo: 'To do',
  other: 'Task',
};

const STATUS_FILTER_OPTIONS = [
  'All statuses',
  'Open work orders',
  'Closed work orders',
  'Archived',
];

function normalizeStatus(value?: string | null): WorkOrderStatus {
  switch (String(value ?? '').toLowerCase()) {
    case 'in_progress':
    case 'in-progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
    case 'cancelled':
    case 'canceled':
      return 'Cancelled';
    default:
      return 'New';
  }
}

function normalizePriority(value?: string | null): WorkOrderPriority {
  switch (String(value ?? '').toLowerCase()) {
    case 'low':
      return 'Low';
    case 'high':
      return 'High';
    case 'urgent':
      return 'Urgent';
    default:
      return 'Normal';
  }
}

function formatDateLabel(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'M/d/yyyy');
}

function formatDateTimeLabel(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'M/d/yyyy h:mm a');
}

function relativeLabel(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatDistanceToNow(date, { addSuffix: true });
}

function taskLabel(task?: TaskRow | null): string | null {
  if (!task) return null;
  const kindLabel = task.task_kind ? (TASK_KIND_LABELS[task.task_kind] ?? 'Task') : 'Task';
  const idPart = task.buildium_task_id ? ` | ${task.buildium_task_id}` : '';
  return `${kindLabel}${idPart}`;
}

export default async function MaintenancePage() {
  const db = supabaseAdmin || supabase;

  const { data: workOrdersData, error: workOrdersError } = (await db
    .from('work_orders')
    .select(
      'id, buildium_work_order_id, subject, status, priority, scheduled_date, created_at, updated_at, property_id, unit_id, vendor_id, assigned_to',
    )
    .order('created_at', { ascending: false })
    .limit(50)) as { data: WorkOrderRow[] | null; error: unknown };

  if (workOrdersError) {
    console.error('Failed to load work orders', workOrdersError);
  }

  const workOrderRows: WorkOrderRow[] = workOrdersData ?? [];

  const propertyIds = Array.from(
    new Set(
      workOrderRows.map((order) => order.property_id).filter((id): id is string => Boolean(id)),
    ),
  );
  const unitIds = Array.from(
    new Set(workOrderRows.map((order) => order.unit_id).filter((id): id is string => Boolean(id))),
  );
  const vendorIds = Array.from(
    new Set(
      workOrderRows.map((order) => order.vendor_id).filter((id): id is string => Boolean(id)),
    ),
  );

  const propertyMap = new Map<string, Pick<PropertyRow, 'name'>>();
  const unitMap = new Map<string, Pick<UnitRow, 'unit_number' | 'property_id'>>();
  const vendorMap = new Map<string, string>();

  if (propertyIds.length > 0) {
    const { data, error } = await db.from('properties').select('id, name').in('id', propertyIds);
    if (error) {
      console.error('Failed to load properties for work orders', error);
    } else {
      data?.forEach((property) => {
        propertyMap.set(property.id, { name: property.name });
      });
    }
  }

  const unitPropertyIds = new Set<string>();
  if (unitIds.length > 0) {
    const { data, error } = await db
      .from('units')
      .select('id, unit_number, property_id')
      .in('id', unitIds);
    if (error) {
      console.error('Failed to load units for work orders', error);
    } else {
      data?.forEach((unit) => {
        unitMap.set(unit.id, { unit_number: unit.unit_number, property_id: unit.property_id });
        if (unit.property_id) unitPropertyIds.add(unit.property_id);
      });
    }
  }

  const additionalPropertyIds = Array.from(unitPropertyIds).filter((id) => !propertyMap.has(id));
  if (additionalPropertyIds.length > 0) {
    const { data, error } = await db
      .from('properties')
      .select('id, name')
      .in('id', additionalPropertyIds);
    if (error) {
      console.error('Failed to load additional properties for units', error);
    } else {
      data?.forEach((property) => {
        propertyMap.set(property.id, { name: property.name });
      });
    }
  }

  if (vendorIds.length > 0) {
    const { data, error } = (await db
      .from('vendors')
      .select(
        'id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)',
      )
      .in('id', vendorIds)) as {
      data: Array<{
        id: string;
        contact?: Pick<
          ContactRow,
          'display_name' | 'company_name' | 'first_name' | 'last_name'
        > | null;
      }> | null;
      error: unknown;
    };
    if (error) {
      console.error('Failed to load vendors for work orders', error);
    } else {
      data?.forEach((vendor) => {
        const contact = vendor.contact;
        const fullName = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ');
        const label = contact?.display_name || contact?.company_name || fullName || 'Vendor';
        vendorMap.set(vendor.id, label);
      });
    }
  }

  const tasksByUnit = new Map<string, TaskRow>();
  const tasksByProperty = new Map<string, TaskRow>();

  if (unitIds.length > 0) {
    const { data, error } = (await db
      .from('tasks')
      .select('id, subject, task_kind, buildium_task_id, unit_id, property_id, created_at')
      .in('unit_id', unitIds)
      .order('created_at', { ascending: false })) as { data: TaskRow[] | null; error: unknown };
    if (error) {
      console.error('Failed to load unit tasks for work orders', error);
    } else {
      data?.forEach((task) => {
        if (task.unit_id && !tasksByUnit.has(task.unit_id)) {
          tasksByUnit.set(task.unit_id, task);
        }
      });
    }
  }

  if (propertyIds.length > 0) {
    const { data, error } = (await db
      .from('tasks')
      .select('id, subject, task_kind, buildium_task_id, unit_id, property_id, created_at')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false })) as { data: TaskRow[] | null; error: unknown };
    if (error) {
      console.error('Failed to load property tasks for work orders', error);
    } else {
      data?.forEach((task) => {
        const key = task.property_id;
        if (key && !tasksByProperty.has(key)) {
          tasksByProperty.set(key, task);
        }
      });
    }
  }

  const uiWorkOrders: UIWorkOrder[] = workOrderRows.map((order) => {
    const unit = order.unit_id ? unitMap.get(order.unit_id) : null;
    const propertyFromOrder = order.property_id ? propertyMap.get(order.property_id) : null;
    const propertyFromUnit = unit?.property_id ? propertyMap.get(unit.property_id) : null;
    const propertyName = propertyFromOrder?.name || propertyFromUnit?.name || '—';

    let unitLabel = '—';
    if (unit) {
      const unitNumber = unit.unit_number ? `Unit ${unit.unit_number}` : 'Property level';
      unitLabel = propertyName !== '—' ? `${unitNumber} · ${propertyName}` : unitNumber;
    } else if (propertyName !== '—') {
      unitLabel = propertyName;
    }

    const relatedTask =
      (order.unit_id && tasksByUnit.get(order.unit_id)) ||
      (order.property_id && tasksByProperty.get(order.property_id)) ||
      null;

    const requestType =
      taskLabel(relatedTask) ||
      (order.buildium_work_order_id
        ? `Work order | ${order.buildium_work_order_id}`
        : 'Work order');

    const title = order.subject || relatedTask?.subject || 'Untitled work order';
    const statusLabel = normalizeStatus(order.status);
    const priorityLabel = normalizePriority(order.priority);
    const updatedAt = order.updated_at || order.created_at || null;

    return {
      id: order.buildium_work_order_id ? String(order.buildium_work_order_id) : order.id,
      taskId: relatedTask?.id || null,
      title,
      requestType,
      unit: unitLabel,
      propertyName,
      updatedAt: formatDateTimeLabel(updatedAt),
      updatedRelative: relativeLabel(updatedAt),
      age: relativeLabel(order.created_at),
      status: statusLabel,
      dueDate: formatDateLabel(order.scheduled_date),
      assignedTo: order.assigned_to || '—',
      priority: priorityLabel,
      vendor: order.vendor_id ? vendorMap.get(order.vendor_id) || '—' : '—',
      billTotal: '--',
      billStatus: '—',
    } satisfies UIWorkOrder;
  });

  const propertyFilterOptions = [
    'All properties',
    ...Array.from(
      new Set(uiWorkOrders.map((wo) => wo.propertyName).filter((name) => name && name !== '—')),
    ).sort(),
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Heading as="h1" size="h3">
            Work orders
          </Heading>
          <Label
            as={Link}
            href="#"
            size="sm"
            tone="muted"
            className="flex items-center gap-2 hover:text-foreground"
          >
            <CircleHelp className="size-4" />
            Help
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="shadow-sm">
            <Link href="/maintenance/add-work-order">Add work order</Link>
          </Button>
        </div>
      </div>

      <Card className="border-border/70 border shadow-sm">
        <CardContent className="flex flex-col gap-0 p-0">
          <div className="border-border/70 flex flex-wrap items-center gap-3 border-b px-6 py-4">
            <Select defaultValue="all-properties">
              <SelectTrigger className="min-w-[200px] sm:w-[220px]">
                <SelectValue placeholder="All properties" />
              </SelectTrigger>
              <SelectContent>
                {propertyFilterOptions.map((option) => {
                  const value =
                    option === 'All properties'
                      ? 'all-properties'
                      : option.toLowerCase().replace(/\s+/g, '-');
                  return (
                    <SelectItem key={option} value={value}>
                      {option}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Select defaultValue="all-statuses">
              <SelectTrigger className="min-w-[220px] sm:w-[260px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((option) => {
                  const value =
                    option === 'All statuses'
                      ? 'all-statuses'
                      : option.toLowerCase().replace(/\s+/g, '-');
                  return (
                    <SelectItem key={option} value={value}>
                      {option}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3"
            >
              Add filter option
              <ChevronDown className="size-4" />
            </Button>
          </div>

          <div className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
            <Body as="span" size="sm" tone="muted">
              {uiWorkOrders.length} matches
            </Body>
            <Button
              variant="ghost"
              size="sm"
              className="hover:text-foreground flex items-center gap-2 px-3 text-muted-foreground"
            >
              <Download className="size-4" />
              Export
            </Button>
          </div>

          <div className="px-2 pt-4 pb-2 sm:px-4 md:px-6">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow className="border-border/70 bg-muted/40 border-b tracking-widest uppercase">
                  <TableHead className="pl-2">
                    <Label as="span" size="xs" tone="muted">
                      Work order
                    </Label>
                  </TableHead>
                  <TableHead>
                    <Label as="span" size="xs" tone="muted">
                      Unit
                    </Label>
                  </TableHead>
                  <TableHead>
                    <Label as="span" size="xs" tone="muted">
                      Updated
                    </Label>
                  </TableHead>
                  <TableHead>
                    <Label as="span" size="xs" tone="muted">
                      Age
                    </Label>
                  </TableHead>
                  <TableHead>
                    <Label as="span" size="xs" tone="muted">
                      Status
                    </Label>
                  </TableHead>
                  <TableHead>
                    <Label as="span" size="xs" tone="muted">
                      Due
                    </Label>
                  </TableHead>
                  <TableHead>
                    <Label as="span" size="xs" tone="muted">
                      Assigned to
                    </Label>
                  </TableHead>
                  <TableHead>
                    <Label as="span" size="xs" tone="muted">
                      Priority
                    </Label>
                  </TableHead>
                  <TableHead>
                    <Label as="span" size="xs" tone="muted">
                      Vendor
                    </Label>
                  </TableHead>
                  <TableHead>
                    <Label as="span" size="xs" tone="muted">
                      Bill total
                    </Label>
                  </TableHead>
                  <TableHead>
                    <Label as="span" size="xs" tone="muted">
                      Bill status
                    </Label>
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uiWorkOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-12 text-center">
                      <Body as="span" size="sm" tone="muted">
                        No work orders found.
                      </Body>
                    </TableCell>
                  </TableRow>
                ) : (
                  uiWorkOrders.map((order) => (
                    <TableRow key={order.id} className="border-border/70 border-b last:border-0">
                      <TableCell className="px-2 py-4 align-top whitespace-normal">
                        {order.taskId ? (
                          <Label
                            as={Link}
                            href={`/tasks/${order.taskId}?tab=work-orders&workOrderId=${order.id}`}
                            size="sm"
                            className="leading-5 text-primary hover:underline"
                          >
                            {order.title}
                          </Label>
                        ) : (
                          <Label as="span" size="sm" className="leading-5 text-primary">
                            {order.title}
                          </Label>
                        )}
                        <Body as="p" size="xs" tone="muted" className="mt-1">
                          {order.requestType}
                        </Body>
                      </TableCell>
                      <TableCell className="py-4 align-top whitespace-normal">
                        <Body as="span" size="sm" tone="muted">
                          {order.unit}
                        </Body>
                      </TableCell>
                      <TableCell className="py-4 align-top whitespace-normal">
                        <Body as="p" size="sm">
                          {order.updatedAt}
                        </Body>
                        <Body as="p" size="xs" tone="muted">
                          {order.updatedRelative}
                        </Body>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <Body as="span" size="sm">
                          {order.age}
                        </Body>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <Badge
                          variant="outline"
                          className={`status-pill ${STATUS_BADGE_STYLES[order.status]}`}
                        >
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <Body as="span" size="sm">
                          {order.dueDate}
                        </Body>
                      </TableCell>
                      <TableCell className="py-4 align-top whitespace-normal">
                        <Label as="span" size="sm">
                          {order.assignedTo}
                        </Label>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${PRIORITY_DOT_STYLES[order.priority]}`}
                          />
                          <Body as="span" size="sm">
                            {order.priority}
                          </Body>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-top whitespace-normal">
                        <Body as="span" size="sm">
                          {order.vendor}
                        </Body>
                      </TableCell>
                      <TableCell className="py-4 align-top whitespace-normal">
                        <Label as="p" size="sm" tone="muted">
                          {order.billTotal}
                        </Label>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <Body as="span" size="sm" tone="muted">
                          {order.billStatus}
                        </Body>
                      </TableCell>
                      <TableCell className="py-4 text-right align-top">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Open actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
