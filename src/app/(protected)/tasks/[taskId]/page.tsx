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

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];
type UnitRow = Database['public']['Tables']['units']['Row'];
type TaskHistoryRow = Database['public']['Tables']['task_history']['Row'];

type PageProps = {
  params: Promise<{ taskId: string }>;
};

async function resolveParams(params: PageProps['params']) {
  if (params instanceof Promise) return params;
  return params;
}

export default async function TaskDetailsPage({ params }: PageProps) {
  const { taskId } = await resolveParams(params);
  const db = supabaseAdmin || supabase;

  const { data: task, error } = await db
    .from('tasks')
    .select(
      'id, subject, description, status, priority, scheduled_date, created_at, updated_at, category, task_kind, buildium_task_id, assigned_to, property_id, unit_id, requested_by_type, requested_by_contact_id, requested_by_buildium_id',
    )
    .eq('id', taskId)
    .maybeSingle<TaskRow>();

  if (error) {
    console.error('Failed to load task', error);
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
    if (propertyError) {
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
    if (unitError) {
      console.error(`Failed to load unit ${task.unit_id} for task ${task.id}`, unitError);
    } else {
      unit = data;
    }
  }

  const { data: historyRows, error: historyError } = await db
    .from('task_history')
    .select('id, notes, status, assigned_to, created_at')
    .eq('task_id', task.id)
    .order('created_at', { ascending: false });

  if (historyError) {
    console.error(`Failed to load task history for task ${task.id}`, historyError);
  }

  const statusMeta = normalizeTaskStatus(task.status);
  const priorityMeta = normalizeTaskPriority(task.priority);
  const dueDateLabel = formatTaskDate(task.scheduled_date);
  const createdLabel = formatTaskDateTime(task.created_at);
  const updatedLabel = formatTaskDateTime(task.updated_at);
  const updatedRelativeLabel = formatTaskRelative(task.updated_at);
  const ageLabel = formatTaskRelative(task.created_at, false);
  const assignedTo = task.assigned_to || null;
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
  const priorityDotTone: Record<TaskPriorityKey, string> = {
    low: 'bg-[var(--color-gray-400)]',
    normal: 'bg-[var(--color-warning-600)]',
    high: 'bg-[var(--color-danger-500)]',
    urgent: 'bg-[var(--color-danger-700)]',
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
        title={<span className="text-foreground text-3xl font-semibold tracking-tight">{task.subject || 'Untitled task'}</span>}
        description={`${kindLabel}${task.buildium_task_id ? ` • ${referenceLabel}` : ''}`}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-2">
              <CircleHelp className="size-4" aria-hidden />
              Help
            </Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm">
              Update task
            </Button>
            <Button variant="outline" size="icon" className="border-border/70">
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
          <Tabs defaultValue="summary" className="space-y-6">
            <div className="border-border/70 border-b">
              <TabsList className="bg-transparent p-0">
                <TabsTrigger
                  value="summary"
                  className="data-[state=inactive]:text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none border-b-2 border-transparent px-1 pt-2 pb-3 text-sm font-medium transition-colors"
                >
                  Summary
                </TabsTrigger>
                <TabsTrigger
                  value="work-orders"
                  disabled
                  className="text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none border-b-2 border-transparent px-1 pt-2 pb-3 text-sm font-medium"
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
                      <CardContent className="space-y-6 p-6">
                        <div className="grid gap-6 sm:grid-cols-3">
                          <div>
                            <p className="text-muted-foreground text-xs tracking-widest uppercase">
                              Status
                            </p>
                            <div className="mt-2">
                              <Badge
                                className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeTone[statusMeta.key]}`}
                                variant="outline"
                              >
                                {statusMeta.label}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs tracking-widest uppercase">
                              Priority
                            </p>
                            <div className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
                              <span
                                className={`size-2.5 rounded-full ${priorityDotTone[priorityMeta.key]}`}
                                aria-hidden
                              />
                              <span
                                className={`rounded-full px-2 py-1 ${priorityTone[priorityMeta.key]}`}
                              >
                                {priorityMeta.label}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-xs tracking-widest uppercase">
                              Due date
                            </p>
                            <p className="text-foreground mt-2 text-sm font-medium">{dueDateLabel}</p>
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
                            <p className="text-muted-foreground text-xs tracking-widest uppercase">
                              Category
                            </p>
                            <p className="text-sm">{task.category || 'Uncategorized'}</p>
                          </div>
                        </div>

                        <div className="border-border/70 bg-muted/40 rounded-lg border border-dashed p-6">
                          <h3 className="text-foreground text-sm font-semibold">Description</h3>
                          <p className="text-muted-foreground mt-2 text-sm leading-6">
                            {task.description?.trim() || 'No description provided for this task.'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                      <CardHeader className="flex flex-row items-start justify-between border-b border-border/70 pb-4">
                        <CardTitle>Custom fields</CardTitle>
                        <Button variant="ghost" size="sm" className="gap-1 px-2">
                          Add custom field
                        </Button>
                      </CardHeader>
                      <CardContent className="p-6">
                        <p className="text-muted-foreground text-sm">
                          You do not have any custom fields created to track additional information
                          for this task.
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                      <CardHeader className="flex flex-row items-start justify-between border-b border-border/70 pb-4">
                        <CardTitle>Files</CardTitle>
                        <Button variant="ghost" size="sm" className="gap-1 px-2">
                          Add attachments
                        </Button>
                      </CardHeader>
                      <CardContent className="p-6">
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
                        <Button variant="ghost" size="sm" className="gap-1 px-2">
                          Link tasks
                        </Button>
                      </CardHeader>
                      <CardContent className="p-6">
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
                          <Button variant="outline" size="sm" className="border-border/70 gap-2">
                            <Plus className="size-4" aria-hidden />
                            Add update
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6 p-6">
                        <div className="relative space-y-6">
                          {updates.map((entry, index) => (
                            <div key={entry.id} className="relative pl-8">
                              <span className="bg-primary absolute top-1.5 left-0 size-2 rounded-full" />
                              {index < updates.length - 1 ? (
                                <span
                                  className="bg-border absolute top-4 left-[3px] h-full w-px"
                                  aria-hidden
                                />
                              ) : null}
                              <div className="space-y-2">
                                <p className="text-foreground text-sm font-medium">{entry.title}</p>
                                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                                  <span>{entry.timestamp}</span>
                                  <span aria-hidden>•</span>
                                  <span>{entry.relative}</span>
                                </div>
                                <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                                  <Badge
                                    variant="outline"
                                    className={`rounded-full border px-3 py-1 text-[11px] font-medium ${statusBadgeTone[entry.statusKey]}`}
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
                        <CardDescription>Where this issue lives.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 p-6">
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
                            <Button variant="outline" size="sm" className="w-full gap-2">
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
                      <CardContent className="space-y-4 p-6">
                        <div className="border-border/70 bg-muted/40 text-muted-foreground grid grid-cols-2 gap-2 rounded-lg border p-1 text-sm font-medium">
                          <div className="text-foreground rounded-md bg-white px-3 py-2 shadow-sm">
                            Staff
                          </div>
                          <div className="rounded-md px-3 py-2">Vendors</div>
                        </div>
                        <div className="border-border/70 rounded-lg border bg-white p-4 shadow-sm">
                          {assignedTo ? (
                            <div className="flex items-center gap-3">
                              <Avatar className="border-border/70 size-10 border">
                                <AvatarFallback className="bg-orange-100 text-sm font-medium text-orange-700">
                                  {assignedInitials || '??'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="space-y-0.5">
                                <p className="text-foreground text-sm font-medium">{assignedTo}</p>
                                <p className="text-muted-foreground text-xs">Staff member</p>
                              </div>
                              <Button variant="ghost" size="sm" className="ml-auto px-2 text-sm">
                                Edit
                              </Button>
                            </div>
                          ) : (
                            <div className="text-muted-foreground space-y-2 text-sm">
                              <p>No staff assigned to this task.</p>
                              <Button variant="ghost" size="sm" className="px-2 text-sm">
                                Add staff
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="border-border/70 text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                          Add collaborators you want to notify.
                        </div>
                        <Button variant="outline" size="sm" className="border-border/70 w-full">
                          Email staff
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-border/70 shadow-sm">
                      <CardHeader className="border-b border-border/70 pb-4">
                        <CardTitle>Contacts</CardTitle>
                        <CardDescription>People involved with this request.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 p-6">
                        <div className="border-border/70 rounded-lg border bg-white p-4 shadow-sm">
                          <p className="text-muted-foreground text-xs tracking-widest uppercase">
                            Requested by
                          </p>
                          <p className="text-foreground mt-2 text-sm font-medium">
                            {task.requested_by_type
                              ? task.requested_by_type.replace(/_/g, ' ')
                              : 'Not provided'}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            ID:{' '}
                            {task.requested_by_contact_id
                              ? task.requested_by_contact_id
                              : task.requested_by_buildium_id
                                ? task.requested_by_buildium_id
                                : '—'}
                          </p>
                        </div>
                        <div className="border-border/70 text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
                          Add owner or tenant contacts to message them quickly.
                        </div>
                        <Button variant="outline" size="sm" className="border-border/70 w-full">
                          Email contacts
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                }
              />
            </TabsContent>

            <TabsContent value="work-orders" className="focus-visible:outline-none">
              <Card className="border-border/70 shadow-sm">
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-sm">
                    Linked work orders will appear here once available.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </Stack>
      </PageBody>
    </PageShell>
  );
}
