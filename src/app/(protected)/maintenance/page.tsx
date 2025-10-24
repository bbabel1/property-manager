import Link from 'next/link';
import {
  CircleHelp,
  Download,
  MoreHorizontal,
  ChevronDown,
} from 'lucide-react';
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

type WorkOrderStatus = 'New' | 'In progress' | 'Completed' | 'Cancelled';
type WorkOrderPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'];
type TaskRow = Database['public']['Tables']['tasks']['Row'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];
type UnitRow = Database['public']['Tables']['units']['Row'];

type UIWorkOrder = {
  id: string;
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
  New: 'border-amber-200 bg-amber-50 text-amber-700',
  'In progress': 'border-sky-200 bg-sky-50 text-sky-700',
  Completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Cancelled: 'border-border bg-muted/60 text-muted-foreground',
};

const PRIORITY_DOT_STYLES: Record<WorkOrderPriority, string> = {
  High: 'bg-rose-500',
  Normal: 'bg-amber-400',
  Low: 'bg-slate-400',
  Urgent: 'bg-rose-600',
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
  const kindLabel = task.task_kind ? TASK_KIND_LABELS[task.task_kind] ?? 'Task' : 'Task';
  const idPart = task.buildium_task_id ? ` | ${task.buildium_task_id}` : '';
  return `${kindLabel}${idPart}`;
}

export default async function MaintenancePage() {
  const db = supabaseAdmin || supabase;

  const { data: workOrdersData, error: workOrdersError } = await db
    .from('work_orders')
    .select(
      'id, buildium_work_order_id, subject, status, priority, scheduled_date, created_at, updated_at, property_id, unit_id, vendor_id, assigned_to',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (workOrdersError) {
    console.error('Failed to load work orders', workOrdersError);
  }

  const workOrderRows: WorkOrderRow[] = workOrdersData ?? [];

  const propertyIds = Array.from(
    new Set(workOrderRows.map((order) => order.property_id).filter((id): id is string => Boolean(id))),
  );
  const unitIds = Array.from(
    new Set(workOrderRows.map((order) => order.unit_id).filter((id): id is string => Boolean(id))),
  );
  const vendorIds = Array.from(
    new Set(workOrderRows.map((order) => order.vendor_id).filter((id): id is string => Boolean(id))),
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
    const { data, error } = await db.from('units').select('id, unit_number, property_id').in('id', unitIds);
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
    const { data, error } = await db.from('properties').select('id, name').in('id', additionalPropertyIds);
    if (error) {
      console.error('Failed to load additional properties for units', error);
    } else {
      data?.forEach((property) => {
        propertyMap.set(property.id, { name: property.name });
      });
    }
  }

  if (vendorIds.length > 0) {
    const { data, error } = await db
      .from('vendors')
      .select('id, display_name, company_name, name')
      .in('id', vendorIds);
    if (error) {
      console.error('Failed to load vendors for work orders', error);
    } else {
      data?.forEach((vendor) => {
        const label = vendor.display_name || vendor.company_name || vendor.name || 'Vendor';
        vendorMap.set(vendor.id, label);
      });
    }
  }

  const tasksByUnit = new Map<string, TaskRow>();
  const tasksByProperty = new Map<string, TaskRow>();

  if (unitIds.length > 0) {
    const { data, error } = await db
      .from('tasks')
      .select('id, subject, task_kind, buildium_task_id, unit_id, property_id, created_at')
      .in('unit_id', unitIds)
      .order('created_at', { ascending: false });
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
    const { data, error } = await db
      .from('tasks')
      .select('id, subject, task_kind, buildium_task_id, unit_id, property_id, created_at')
      .in('property_id', propertyIds)
      .order('created_at', { ascending: false });
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

    const relatedTask = (order.unit_id && tasksByUnit.get(order.unit_id)) ||
      (order.property_id && tasksByProperty.get(order.property_id)) ||
      null;

    const requestType = taskLabel(relatedTask)
      || (order.buildium_work_order_id ? `Work order | ${order.buildium_work_order_id}` : 'Work order');

    const title = order.subject || relatedTask?.subject || 'Untitled work order';
    const statusLabel = normalizeStatus(order.status);
    const priorityLabel = normalizePriority(order.priority);
    const updatedAt = order.updated_at || order.created_at || null;

    return {
      id: order.buildium_work_order_id ? String(order.buildium_work_order_id) : order.id,
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
    ...Array.from(new Set(uiWorkOrders.map((wo) => wo.propertyName).filter((name) => name && name !== '—'))).sort(),
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Work orders</h1>
          <Link
            href="#"
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm font-medium"
          >
            <CircleHelp className="size-4" />
            Help
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild className="shadow-sm">
            <Link href="/maintenance/add-work-order">Add work order</Link>
          </Button>
        </div>
      </div>

      <Card className="border border-border/70 shadow-sm">
        <CardContent className="flex flex-col gap-0 p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-6 py-4">
            <Select defaultValue="all-properties">
              <SelectTrigger className="min-w-[200px] sm:w-[220px]">
                <SelectValue placeholder="All properties" />
              </SelectTrigger>
              <SelectContent>
                {propertyFilterOptions.map((option) => {
                  const value = option === 'All properties'
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
                  const value = option === 'All statuses'
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-6 py-3 text-sm text-muted-foreground">
            <span>{uiWorkOrders.length} matches</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground flex items-center gap-2 px-3"
            >
              <Download className="size-4" />
              Export
            </Button>
          </div>

          <div className="px-2 pb-2 pt-4 sm:px-4 md:px-6">
            <Table className="min-w-[960px]">
              <TableHeader>
                <TableRow className="border-b border-border/70 bg-muted/40 text-xs uppercase tracking-widest text-muted-foreground">
                  <TableHead className="pl-2 text-xs font-semibold tracking-wide text-muted-foreground">
                    Work order
                  </TableHead>
                  <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Unit
                  </TableHead>
                  <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Updated
                  </TableHead>
                  <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Age
                  </TableHead>
                  <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Due
                  </TableHead>
                  <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Assigned to
                  </TableHead>
                  <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Priority
                  </TableHead>
                  <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Vendor
                  </TableHead>
                  <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Bill total
                  </TableHead>
                  <TableHead className="text-xs font-semibold tracking-wide text-muted-foreground">
                    Bill status
                  </TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uiWorkOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="py-12 text-center text-sm text-muted-foreground">
                      No work orders found.
                    </TableCell>
                  </TableRow>
                ) : (
                  uiWorkOrders.map((order) => (
                    <TableRow key={order.id} className="border-b border-border/70 last:border-0">
                      <TableCell className="whitespace-normal px-2 py-4 align-top text-sm">
                        <Link
                          href="#"
                          className="text-primary hover:underline font-medium leading-5"
                        >
                          {order.title}
                        </Link>
                        <p className="text-muted-foreground mt-1 text-xs">{order.requestType}</p>
                      </TableCell>
                      <TableCell className="whitespace-normal py-4 align-top text-sm text-muted-foreground">
                        {order.unit}
                      </TableCell>
                      <TableCell className="whitespace-normal py-4 align-top text-sm">
                        <p>{order.updatedAt}</p>
                        <p className="text-muted-foreground text-xs">{order.updatedRelative}</p>
                      </TableCell>
                      <TableCell className="py-4 align-top text-sm">{order.age}</TableCell>
                      <TableCell className="py-4 align-top text-sm">
                        <Badge variant="outline" className={STATUS_BADGE_STYLES[order.status]}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 align-top text-sm">{order.dueDate}</TableCell>
                      <TableCell className="whitespace-normal py-4 align-top text-sm">
                        <p className="font-medium text-foreground">{order.assignedTo}</p>
                      </TableCell>
                      <TableCell className="py-4 align-top text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${PRIORITY_DOT_STYLES[order.priority]}`}
                          />
                          <span>{order.priority}</span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-normal py-4 align-top text-sm">
                        {order.vendor}
                      </TableCell>
                      <TableCell className="whitespace-normal py-4 align-top text-sm">
                        <p className="font-medium text-muted-foreground">{order.billTotal}</p>
                      </TableCell>
                      <TableCell className="py-4 align-top text-sm">
                        <span className="text-muted-foreground">{order.billStatus}</span>
                      </TableCell>
                      <TableCell className="py-4 align-top text-right">
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
