import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CircleHelp, MapPin, MoreHorizontal, Plus, CalendarDays, Clock } from 'lucide-react';

import { supabase, supabaseAdmin } from '@/lib/db';
import {
  Cluster,
  PageBody,
  PageColumns,
  PageHeader,
  PageShell,
  Stack,
} from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  formatTaskDate,
  formatTaskDateTime,
  formatTaskRelative,
  normalizeTaskPriority,
  normalizeTaskStatus,
  taskAssigneeInitials,
  taskKindLabel,
  type TaskPriorityKey,
  type TaskStatusKey,
} from '@/lib/tasks/utils';
import type { Database } from '@/types/database';
import TaskWorkOrdersPanel, { type WorkOrderListItem } from '@/components/tasks/TaskWorkOrdersPanel';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskHistoryRow = Database['public']['Tables']['task_history']['Row'];
type WorkOrderRow = Database['public']['Tables']['work_orders']['Row'];
type WorkOrderListQueryRow = Pick<
  WorkOrderRow,
  | 'id'
  | 'buildium_work_order_id'
  | 'subject'
  | 'status'
  | 'priority'
  | 'scheduled_date'
  | 'created_at'
  | 'updated_at'
  | 'property_id'
  | 'unit_id'
  | 'vendor_id'
  | 'category'
  | 'assigned_to'
  | 'description'
  | 'notes'
>;
type PropertyRow = Database['public']['Tables']['properties']['Row'];
type UnitRow = Database['public']['Tables']['units']['Row'];
type VendorRow = Database['public']['Tables']['vendors']['Row'];

type PageProps = {
  params: Promise<{ taskId: string }>;
  searchParams?: Promise<{ tab?: string; workOrderId?: string }>;
};

async function resolveParams(params: PageProps['params']) {
  if (params instanceof Promise) return params;
  return params;
}

export default async function TaskDetailsPage({ params, searchParams }: PageProps) {
  const { taskId } = await resolveParams(params);
  const resolvedSearch = searchParams ? await searchParams : {};
  const db = supabaseAdmin || supabase;
  const initialTab = resolvedSearch.tab === 'work-orders' ? 'work-orders' : 'summary';
  const initialWorkOrderId = resolvedSearch.workOrderId || null;

  const selectWithSubcategory =
    'id, subject, description, status, priority, scheduled_date, created_at, updated_at, category, subcategory, task_kind, buildium_task_id, assigned_to, assigned_to_staff_id, buildium_assigned_to_user_id, property_id, unit_id, requested_by_type, requested_by_contact_id, requested_by_buildium_id, subcat:task_categories!tasks_subcategory_fkey(name)';
  const selectWithoutSubcategory =
    'id, subject, description, status, priority, scheduled_date, created_at, updated_at, category, task_kind, buildium_task_id, assigned_to, assigned_to_staff_id, buildium_assigned_to_user_id, property_id, unit_id, requested_by_type, requested_by_contact_id, requested_by_buildium_id';

  let taskError: any = null;
  let task: TaskRow | null = null;

  const primary = await db
    .from('tasks')
    .select(selectWithSubcategory)
    .eq('id', taskId)
    .maybeSingle<TaskRow>();

  task = primary.data as (TaskRow & { subcat?: { name?: string | null } }) | null;
  taskError = primary.error;

  // Fallback if the subcategory column does not exist in this environment
  if (taskError?.message && /column .*subcategory/i.test(taskError.message)) {
    const fallback = await db
      .from('tasks')
      .select(selectWithoutSubcategory)
      .eq('id', taskId)
      .maybeSingle<TaskRow>();
    task = (fallback.data as TaskRow | null) ?? (task as TaskRow | null);
    taskError = fallback.error;
    if (task && typeof (task as any).subcategory === 'undefined') {
      // Ensure shape stays consistent for downstream usage
      task = { ...task, subcategory: null } as TaskRow;
    }
  }

  const subcategoryName =
    (task as any)?.subcat?.name ??
    (typeof (task as any)?.subcategory === 'string' && (task as any).subcategory?.length === 36
      ? null
      : (task as any)?.subcategory) ??
    null;

  if (taskError?.message) {
    console.error('Failed to load task', taskError);
  }

  if (!task) {
    notFound();
  }

  let property: Pick<
    PropertyRow,
    'id' | 'name' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
  > | null = null;
  if (task.property_id) {
    const { data, error: propertyError } = (await db
      .from('properties')
      .select('id, name, address_line1, address_line2, city, state, postal_code')
      .eq('id', task.property_id)
      .maybeSingle()) as {
      data: Pick<
        PropertyRow,
        'id' | 'name' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
      > | null;
      error: any;
    };
    if (propertyError?.message) {
      console.error(
        `Failed to load property ${task.property_id} for task ${task.id}`,
        propertyError,
      );
    } else {
      property = data;
    }
  }

  let unit: Pick<UnitRow, 'id' | 'unit_number'> | null = null;
  if (task.unit_id) {
    const { data, error: unitError } = (await db
      .from('units')
      .select('id, unit_number')
      .eq('id', task.unit_id)
      .maybeSingle()) as {
      data: Pick<UnitRow, 'id' | 'unit_number'> | null;
      error: any;
    };
    if (unitError?.message) {
      console.error(`Failed to load unit ${task.unit_id} for task ${task.id}`, unitError);
    } else {
      unit = data;
    }
  }

  type ContactNameFields = Pick<
    Database['public']['Tables']['contacts']['Row'],
    'id' | 'display_name' | 'first_name' | 'last_name' | 'company_name' | 'is_company'
  >;

  let requesterContact: ContactNameFields | null = null;
  if (task.requested_by_contact_id) {
    const { data, error: contactError } = (await db
      .from('contacts')
      .select('id, display_name, first_name, last_name, company_name, is_company')
      .eq('id', task.requested_by_contact_id)
      .maybeSingle()) as { data: ContactNameFields | null; error: any };

    if (contactError?.message) {
      console.error(
        `Failed to load requested-by contact ${task.requested_by_contact_id} for task ${task.id}`,
        contactError,
      );
    } else {
      requesterContact = data;
    }
  } else if (task.requested_by_buildium_id) {
    const { data, error: contactError } = (await db
      .from('contacts')
      .select('id, display_name, first_name, last_name, company_name, is_company')
      .eq('buildium_contact_id', task.requested_by_buildium_id)
      .maybeSingle()) as { data: ContactNameFields | null; error: any };

    if (contactError?.message) {
      console.error(
        `Failed to load requested-by contact by Buildium ID ${task.requested_by_buildium_id} for task ${task.id}`,
        contactError,
      );
    } else {
      requesterContact = data;
    }
  }

  type StaffNameFields = Pick<
    Database['public']['Tables']['staff']['Row'],
    'id' | 'first_name' | 'last_name' | 'email' | 'buildium_user_id'
  >;

  let assignedStaff: StaffNameFields | null = null;
  const numericAssignee =
    task.assigned_to && /^\d+$/.test(task.assigned_to) ? Number(task.assigned_to) : null;
  const buildiumAssigneeId = task.buildium_assigned_to_user_id ?? numericAssignee;

  if (task.assigned_to_staff_id) {
    const { data, error: staffError } = (await db
      .from('staff')
      .select('id, first_name, last_name, email, buildium_user_id')
      .eq('id', task.assigned_to_staff_id)
      .maybeSingle()) as { data: StaffNameFields | null; error: any };

    if (staffError?.message) {
      console.error(
        `Failed to load staff member ${task.assigned_to_staff_id} for task ${task.id}`,
        staffError,
      );
    } else {
      assignedStaff = data;
    }
  } else if (buildiumAssigneeId) {
    const { data, error: staffError } = (await db
      .from('staff')
      .select('id, first_name, last_name, email, buildium_user_id')
      .eq('buildium_user_id', buildiumAssigneeId)
      .maybeSingle()) as { data: StaffNameFields | null; error: any };

    if (staffError?.message) {
      console.error(
        `Failed to load staff member by Buildium user ID ${buildiumAssigneeId} for task ${task.id}`,
        staffError,
      );
    } else {
      assignedStaff = data;
    }
  }

  const { data: historyRows, error: historyError } = await db
    .from('task_history')
    .select('id, notes, status, assigned_to, created_at')
    .eq('task_id', task.id)
    .order('created_at', { ascending: false });

  if (historyError?.message) {
    console.error(`Failed to load task history for task ${task.id}`, historyError);
  }

  const statusMeta = normalizeTaskStatus(task.status);
  const priorityMeta = normalizeTaskPriority(task.priority);
  const dueDateLabel = formatTaskDate(task.scheduled_date);
  const createdLabel = formatTaskDateTime(task.created_at);
  const updatedLabel = formatTaskDateTime(task.updated_at);
  const updatedRelativeLabel = formatTaskRelative(task.updated_at);
  const ageLabel = formatTaskRelative(task.created_at, false);
  const requesterDisplayName =
    requesterContact?.display_name ||
    requesterContact?.company_name ||
    [requesterContact?.first_name, requesterContact?.last_name].filter(Boolean).join(' ').trim() ||
    null;
  const requesterTypeLabel = task.requested_by_type
    ? task.requested_by_type.replace(/_/g, ' ')
    : null;
  const requestedByPrimary = requesterDisplayName || requesterTypeLabel || 'Not provided';
  const requestedBySecondary =
    requesterDisplayName && requesterTypeLabel
      ? requesterTypeLabel
      : !requesterDisplayName && !requesterTypeLabel
        ? task.requested_by_contact_id || task.requested_by_buildium_id
          ? `ID: ${task.requested_by_contact_id ?? task.requested_by_buildium_id}`
          : null
        : null;
  const assignedStaffName =
    assignedStaff?.first_name || assignedStaff?.last_name
      ? [assignedStaff?.first_name, assignedStaff?.last_name].filter(Boolean).join(' ').trim() ||
        assignedStaff?.email ||
        null
      : assignedStaff?.email || null;
  const assignedTo = assignedStaffName || task.assigned_to || null;
  const assignedInitials = taskAssigneeInitials(assignedTo);
  const propertyName = property?.name || null;
  const propertyAddress = [
    property?.address_line1,
    property?.address_line2,
    [property?.city, property?.state].filter(Boolean).join(', '),
    property?.postal_code,
  ]
    .filter(Boolean)
    .join('\n');
  const unitLabel = unit?.unit_number || null;
  const kindLabel = taskKindLabel(task.task_kind);
  const referenceLabel = task.buildium_task_id
    ? `#${task.buildium_task_id}`
    : `#${task.id.slice(0, 6)}`;

  const timeline = (historyRows as TaskHistoryRow[] | null)?.map((entry) => {
    const entryStatus = normalizeTaskStatus(entry.status);
    return {
      id: entry.id,
      title: entry.notes || 'Status updated',
      status: entryStatus.label,
      statusKey: entryStatus.key,
      assignedTo: entry.assigned_to || null,
      timestamp: formatTaskDateTime(entry.created_at),
      relative: formatTaskRelative(entry.created_at),
    };
  });

  const updates =
    timeline && timeline.length > 0
      ? timeline
      : [
          {
            id: 'created',
            title: 'Task created',
            status: statusMeta.label,
            statusKey: statusMeta.key,
            assignedTo,
            timestamp: createdLabel,
            relative: ageLabel,
          },
        ];

  const hasFiles = false;
  const hasLinkedTasks = false;
  const workOrders = await loadWorkOrdersForTask(db, task, propertyName, unitLabel);
  const statusBadgeTone: Record<TaskStatusKey, string> = {
    new: 'border-[var(--color-warning-500)] bg-[var(--color-warning-50)] text-[var(--color-warning-600)]',
    in_progress: 'border-[var(--color-action-200)] bg-[var(--color-action-50)] text-[var(--color-action-700)]',
    completed: 'border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]',
    on_hold: 'border-[var(--color-gray-300)] bg-[var(--color-gray-50)] text-[var(--color-gray-700)]',
    cancelled: 'border-[var(--color-gray-300)] bg-[var(--color-gray-50)] text-[var(--color-gray-600)]',
  };
  const priorityTone: Record<TaskPriorityKey, string> = {
    low: 'border border-[var(--color-gray-300)] bg-[var(--color-gray-100)] text-[var(--color-gray-800)]',
    normal: 'border border-[var(--color-warning-500)] bg-[var(--color-warning-50)] text-[var(--color-warning-600)]',
    high: 'border border-[var(--color-danger-500)] bg-[var(--color-danger-50)] text-[var(--color-danger-600)]',
    urgent: 'border border-[var(--color-danger-600)] bg-[var(--color-danger-50)] text-[var(--color-danger-700)]',
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow={
          <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
            <Link href="/tasks" className="hover:text-foreground">
              Tasks
            </Link>
            <span aria-hidden>/</span>
            <span>{referenceLabel}</span>
          </div>
        }
        title={<span className="text-foreground text-2xl font-semibold tracking-tight">{task.subject || 'Untitled task'}</span>}
        description={`${kindLabel}${task.buildium_task_id ? ` • ${referenceLabel}` : ''}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2" aria-label="Get help with tasks">
              <CircleHelp className="size-4" aria-hidden />
              Help
            </Button>
            <Button variant="default" size="sm">
              Update task
            </Button>
            <Button variant="outline" size="icon" aria-label="More actions">
              <MoreHorizontal className="size-4" aria-hidden />
              <span className="sr-only">More actions</span>
            </Button>
          </>
        }
      >
        <Cluster gap="md" className="text-muted-foreground text-sm">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4" aria-hidden />
            <span>Due {dueDateLabel}</span>
          </span>
          <span className="flex items-center gap-2">
            <Clock className="size-4" aria-hidden />
            <span>Created {createdLabel}</span>
          </span>
          <span>
            Last updated {updatedLabel}
            {updatedRelativeLabel ? ` (${updatedRelativeLabel})` : ''}
          </span>
        </Cluster>
      </PageHeader>

      <PageBody>
        <Stack gap="lg">
          <Tabs defaultValue={initialTab} className="space-y-6">
            <div className="border-b border-border/70">
              <TabsList className="bg-transparent p-0 flex h-auto w-full justify-start gap-8 rounded-none text-muted-foreground">
                <TabsTrigger
                  value="summary"
                  className="h-auto flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:border-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
                >
                  Summary
                </TabsTrigger>
                <TabsTrigger
                  value="work-orders"
                  className="h-auto flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:border-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
                >
                  Work orders
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="summary" className="space-y-6 focus-visible:outline-none">
              <PageColumns
                gap="xl"
                className="items-start"
                primaryClassName="space-y-6"
                secondaryClassName="space-y-6"
                primary={
                  <>
                    <Card className="border-border/70 shadow-sm">
                      <CardContent className="space-y-6">
                        <div className="grid gap-6 sm:grid-cols-3">
                          <div>
                            <label className="text-muted-foreground text-xs font-medium uppercase tracking-wider block mb-2">
                              Status
                            </label>
                            <div>
                              <Badge
                                className={`status-pill ${statusBadgeTone[statusMeta.key]}`}
                                variant="outline"
                                aria-label={`Task status: ${statusMeta.label}`}
                              >
                                {statusMeta.label}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <label className="text-muted-foreground text-xs font-medium uppercase tracking-wider block mb-2">
                              Priority
                            </label>
                            <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
                              <span
                                className={`rounded-full px-2 py-1 ${priorityTone[priorityMeta.key]}`}
                                aria-label={`Task priority: ${priorityMeta.label}`}
                              >
                                {priorityMeta.label}
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="text-muted-foreground text-xs font-medium uppercase tracking-wider block mb-2">
                              Due date
                            </label>
                            <p className="text-foreground text-sm font-medium">{dueDateLabel}</p>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-4 text-sm">
                          <div className="space-y-1">
                            <p className="text-muted-foreground">
                              {kindLabel} {unitLabel ? `• ${unitLabel}` : ''}
                            </p>
                            {propertyName ? (
                              <p className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/properties/${property?.id}`}
                                  className="text-primary hover:underline"
                                >
                                  {propertyName}
                                </Link>
                                {unitLabel ? (
                                  <React.Fragment>
                                    <span aria-hidden>•</span>
                                    <span>{unitLabel}</span>
                                  </React.Fragment>
                                ) : null}
                              </p>
                            ) : (
                              <p className="text-muted-foreground">No property linked</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <label className="text-muted-foreground text-xs font-medium uppercase tracking-wider block">
                              Category
                            </label>
                            <p className="text-sm">
                              {task.category || 'Uncategorized'}
                              {subcategoryName ? (
                                <span className="text-muted-foreground"> {'>'} {subcategoryName}</span>
                              ) : null}
                            </p>
                          </div>
                        </div>

                        <div className="border-border/70 bg-muted/40 rounded-lg border border-dashed p-6">
                          <label className="text-muted-foreground text-xs font-medium uppercase tracking-wider block mb-2">
                            Description
                          </label>
                          <p className="text-foreground text-sm leading-6">
                            {task.description?.trim() || 'No description provided for this task.'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                      <CardHeader className="flex flex-row items-start justify-between border-b border-border/70 pb-4">
                        <CardTitle>Custom fields</CardTitle>
                        <Button variant="ghost" size="sm" className="gap-1 px-2" aria-label="Add custom field">
                          Add custom field
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground text-sm">
                          You do not have any custom fields created to track additional information
                          for this task.
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                      <CardHeader className="flex flex-row items-start justify-between border-b border-border/70 pb-4">
                        <CardTitle>Files</CardTitle>
                        <Button variant="ghost" size="sm" className="gap-1 px-2" aria-label="Add file attachments">
                          Add attachments
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {hasFiles ? (
                          <div>Files go here.</div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No files added yet.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                      <CardHeader className="flex flex-row items-start justify-between border-b border-border/70 pb-4">
                        <CardTitle>Linked tasks</CardTitle>
                        <Button variant="ghost" size="sm" className="gap-1 px-2" aria-label="Link related tasks">
                          Link tasks
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {hasLinkedTasks ? (
                          <div>Linked tasks go here.</div>
                        ) : (
                          <p className="text-muted-foreground text-sm">No linked tasks yet.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                      <CardHeader className="border-b border-border/70 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Updates</CardTitle>
                            <CardDescription>Latest activity on this task.</CardDescription>
                          </div>
                          <Button variant="outline" size="sm" className="gap-2" aria-label="Add update to task">
                            <Plus className="size-4" aria-hidden />
                            Add update
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="relative space-y-6">
                          {updates.map((entry, index) => (
                            <div key={entry.id} className="relative pl-8">
                              <span className="bg-primary absolute top-1.5 left-0 size-2 rounded-full" aria-hidden />
                              {index < updates.length - 1 ? (
                                <span
                                  className="bg-border absolute top-4 left-[3px] h-full w-px"
                                  aria-hidden
                                />
                              ) : null}
                              <div className="space-y-2">
                                <p className="text-foreground text-sm font-medium">{entry.title}</p>
                                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                                  <time dateTime={entry.timestamp}>{entry.timestamp}</time>
                                  <span aria-hidden>•</span>
                                  <span>{entry.relative}</span>
                                </div>
                                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                                  <Badge
                                    variant="outline"
                                    className={`status-pill text-[11px] font-medium ${statusBadgeTone[entry.statusKey]}`}
                                    aria-label={`Status: ${entry.status}`}
                                  >
                                    {entry.status}
                                  </Badge>
                                  {entry.assignedTo ? (
                                    <span>Assigned to {entry.assignedTo}</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                }
                secondary={
                  <>
                    <Card className="border-border/70 shadow-sm">
                      <CardHeader className="border-b border-border/70 pb-4">
                        <CardTitle>Location</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {propertyName ? (
                          <>
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground font-semibold">{propertyName}</p>
                              {unitLabel ? (
                                <p className="text-muted-foreground">Unit {unitLabel}</p>
                              ) : null}
                            </div>
                            <div className="border-border/70 bg-muted/40 rounded-lg border border-dashed p-4 text-sm whitespace-pre-line">
                              {propertyAddress || 'No address on file.'}
                            </div>
                            <Button variant="outline" size="sm" className="w-full gap-2" aria-label="View property location on map">
                              <MapPin className="size-4" aria-hidden />
                              View on map
                            </Button>
                          </>
                        ) : (
                          <p className="text-muted-foreground text-sm">No location linked.</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                      <CardHeader className="border-b border-border/70 pb-4">
                        <CardTitle>Assignees</CardTitle>
                        <CardDescription>Manage who’s responsible.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="border-border/70 bg-muted/40 text-muted-foreground grid grid-cols-2 gap-2 rounded-lg border p-1 text-sm font-medium" role="tablist" aria-label="Assignee type">
                          <div className="text-foreground rounded-md bg-white px-3 py-2 shadow-sm" role="tab" aria-selected="true" aria-label="Staff assignees">
                            Staff
                          </div>
                          <div className="rounded-md px-3 py-2" role="tab" aria-selected="false" aria-label="Vendor assignees">Vendors</div>
                        </div>
                        <div className="border-border/70 rounded-lg border bg-white p-4 shadow-sm">
                          {assignedTo ? (
                            <div className="flex items-center gap-3">
                              <Avatar className="border-border/70 size-10 border" aria-label={`Avatar for ${assignedTo}`}>
                                <AvatarFallback className="bg-orange-100 text-sm font-medium text-orange-700">
                                  {assignedInitials || '??'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="space-y-0.5">
                                <p className="text-foreground text-sm font-medium">{assignedTo}</p>
                                <p className="text-muted-foreground text-xs">Staff member</p>
                              </div>
                              <Button variant="ghost" size="sm" className="ml-auto px-2 text-sm" aria-label={`Edit assignment for ${assignedTo}`}>
                                Edit
                              </Button>
                            </div>
                          ) : (
                            <div className="text-muted-foreground space-y-2 text-sm">
                              <p>No staff assigned to this task.</p>
                              <Button variant="ghost" size="sm" className="px-2 text-sm" aria-label="Add staff member to task">
                                Add staff
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="border-border/70 text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                          Add collaborators you want to notify.
                        </div>
                        <Button variant="outline" size="sm" className="w-full" aria-label="Send email to assigned staff">
                          Email staff
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                      <CardHeader className="border-b border-border/70 pb-4">
                        <CardTitle>Contacts</CardTitle>
                        <CardDescription>People involved with this request.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="border-border/70 rounded-lg border bg-white p-4 shadow-sm">
                          <label className="text-muted-foreground text-xs font-medium uppercase tracking-wider block mb-2">
                            Requested by
                          </label>
                          <p className="text-foreground text-sm font-medium">
                            {requestedByPrimary}
                          </p>
                          {requestedBySecondary ? (
                            <p className="text-muted-foreground text-xs mt-1">{requestedBySecondary}</p>
                          ) : null}
                        </div>
                        <div className="border-border/70 text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                          Add owner or tenant contacts to message them quickly.
                        </div>
                        <Button variant="outline" size="sm" className="w-full" aria-label="Send email to task contacts">
                          Email contacts
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                }
              />
            </TabsContent>

            <TabsContent value="work-orders" className="focus-visible:outline-none">
              <TaskWorkOrdersPanel workOrders={workOrders} initialWorkOrderId={initialWorkOrderId} />
            </TabsContent>
          </Tabs>
        </Stack>
      </PageBody>
    </PageShell>
  );
}

type DBClient = typeof supabase | typeof supabaseAdmin;

function normalizeWorkOrderStatus(value?: string | null): { key: TaskStatusKey; label: string } {
  const normalized = String(value ?? '').toLowerCase();
  switch (normalized) {
    case 'in_progress':
    case 'in-progress':
      return { key: 'in_progress', label: 'In progress' };
    case 'completed':
      return { key: 'completed', label: 'Completed' };
    case 'cancelled':
    case 'canceled':
      return { key: 'cancelled', label: 'Cancelled' };
    default:
      return { key: 'new', label: 'New' };
  }
}

function normalizeWorkOrderPriority(value?: string | null): { key: TaskPriorityKey; label: string } {
  const normalized = String(value ?? '').toLowerCase();
  switch (normalized) {
    case 'low':
      return { key: 'low', label: 'Low' };
    case 'high':
      return { key: 'high', label: 'High' };
    case 'urgent':
      return { key: 'urgent', label: 'Urgent' };
    default:
      return { key: 'normal', label: 'Normal' };
  }
}

async function loadWorkOrdersForTask(
  db: DBClient,
  task: TaskRow,
  propertyName: string | null,
  unitLabel: string | null,
): Promise<WorkOrderListItem[]> {
  if (!task.property_id && !task.unit_id) return [];

  let query = db
    .from('work_orders')
    .select(
      'id, buildium_work_order_id, subject, status, priority, scheduled_date, created_at, updated_at, property_id, unit_id, vendor_id, category, assigned_to, description, notes',
    )
    .order('created_at', { ascending: false });

  if (task.unit_id) {
    query = query.eq('unit_id', task.unit_id);
  } else if (task.property_id) {
    query = query.eq('property_id', task.property_id);
  }

  const { data: workOrderRows, error } = await query.returns<WorkOrderListQueryRow[]>();
  if (error?.message) {
    console.error(`Failed to load work orders for task ${task.id}`, error);
    return [];
  }

  const rows = workOrderRows ?? [];
  if (rows.length === 0) return [];

  const propertyIds = Array.from(
    new Set(rows.map((wo) => wo.property_id).filter((v): v is string => Boolean(v))),
  );
  const unitIds = Array.from(
    new Set(rows.map((wo) => wo.unit_id).filter((v): v is string => Boolean(v))),
  );
  const vendorIds = Array.from(
    new Set(rows.map((wo) => wo.vendor_id).filter((v): v is string => Boolean(v))),
  );
  const workOrderIds = rows.map((wo) => wo.id).filter(Boolean);

  const propertyMap = new Map<string, Pick<PropertyRow, 'name'>>();
  if (propertyIds.length > 0) {
    const { data, error: propertyError } = await (db as any)
      .from('properties')
      .select('id, name')
      .in('id', propertyIds);
    if (propertyError?.message) {
      console.error('Failed to load properties for work orders', propertyError);
    } else {
      data?.forEach((p: Pick<PropertyRow, 'id' | 'name'>) => {
        propertyMap.set(p.id, { name: p.name });
      });
    }
  }

  const unitMap = new Map<string, Pick<UnitRow, 'unit_number'>>();
  if (unitIds.length > 0) {
    const { data, error: unitError } = await (db as any)
      .from('units')
      .select('id, unit_number')
      .in('id', unitIds);
    if (unitError?.message) {
      console.error('Failed to load units for work orders', unitError);
    } else {
      data?.forEach((u: Pick<UnitRow, 'id' | 'unit_number'>) => unitMap.set(u.id, u));
    }
  }

  const vendorMap = new Map<string, string>();
  if (vendorIds.length > 0) {
    const { data, error: vendorError } = (await (db as any)
      .from('vendors')
      .select(
        'id, contact:contacts!vendors_contact_id_fkey(display_name, company_name, first_name, last_name)',
      )
      .in('id', vendorIds)) as { data: (VendorRow & { contact?: any })[] | null; error: any };
    if (vendorError?.message) {
      console.error('Failed to load vendors for work orders', vendorError);
    } else {
      data?.forEach((vendor) => {
        const contact = vendor.contact as
          | {
              display_name?: string | null;
              company_name?: string | null;
              first_name?: string | null;
              last_name?: string | null;
            }
          | null
          | undefined;
        const name =
          contact?.display_name ||
          contact?.company_name ||
          [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() ||
          'Vendor';
        vendorMap.set(vendor.id, name);
      });
    }
  }

  // Load bills linked to these work orders via transactions.work_order_id
  const billsByWorkOrder = new Map<string, { id: string; reference: string }[]>();
  if (workOrderIds.length > 0) {
    const { data: billRows, error: billsErr } = await (db as any)
      .from('transactions')
      .select('id, work_order_id, reference_number, buildium_bill_id')
      .eq('transaction_type', 'Bill')
      .in('work_order_id', workOrderIds);
    if (billsErr?.message) {
      console.error('Failed to load bills for work orders', billsErr);
    } else {
      (billRows || []).forEach((b: any) => {
        const list = billsByWorkOrder.get(b.work_order_id) || [];
        const ref = b.buildium_bill_id ? `Bill #${b.buildium_bill_id}` : b.reference_number || `Bill ${b.id.slice(0, 6)}`;
        list.push({ id: b.id, reference: ref });
        billsByWorkOrder.set(b.work_order_id, list);
      });
    }
  }

  return rows.map((wo) => {
    const safeId = wo.id ? String(wo.id) : '';
    const statusMeta = normalizeWorkOrderStatus(wo.status);
    const priorityMeta = normalizeWorkOrderPriority(wo.priority);
    const propertyLabel =
      propertyMap.get(wo.property_id || '')?.name || propertyName || '—';
    const unitLabelResolved =
      unitMap.get(wo.unit_id || '')?.unit_number || unitLabel || null;
    const vendorLabel = wo.vendor_id ? vendorMap.get(wo.vendor_id) || 'Vendor' : '—';

    return {
      id: safeId,
      reference: wo.buildium_work_order_id
        ? `#${wo.buildium_work_order_id}`
        : `#${safeId.slice(0, 6)}`,
      subject: wo.subject || 'Untitled work order',
      statusKey: statusMeta.key,
      statusLabel: statusMeta.label,
      priorityKey: priorityMeta.key,
      priorityLabel: priorityMeta.label,
      dueDateLabel: formatTaskDate(wo.scheduled_date),
      createdAtLabel: formatTaskDateTime(wo.created_at),
      createdRelativeLabel: formatTaskRelative(wo.created_at),
      updatedAtLabel: formatTaskDateTime(wo.updated_at),
      updatedRelativeLabel: formatTaskRelative(wo.updated_at),
      propertyName: propertyLabel,
      unitLabel: unitLabelResolved,
      vendorName: vendorLabel,
      assignedTo: wo.assigned_to || null,
      categoryLabel: wo.category || '—',
      description: wo.description || null,
      notes: wo.notes || null,
      bills: billsByWorkOrder.get(safeId) || [],
    };
  });
}
