import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  CircleHelp,
  MapPin,
  MoreHorizontal,
  Plus,
  CalendarDays,
  Clock,
} from 'lucide-react';

import { supabase, supabaseAdmin } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
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
  params: Promise<{ taskId: string }> | { taskId: string };
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
    const { data, error: propertyError } = await db
      .from('properties')
      .select('id, name, address_line1, address_line2, city, state, postal_code')
      .eq('id', task.property_id)
      .maybeSingle();
    if (propertyError) {
      console.error(`Failed to load property ${task.property_id} for task ${task.id}`, propertyError);
    } else {
      property = data as typeof property;
    }
  }

  let unit: Pick<UnitRow, 'id' | 'unit_number' | 'unit_name'> | null = null;
  if (task.unit_id) {
    const { data, error: unitError } = await db
      .from('units')
      .select('id, unit_number, unit_name')
      .eq('id', task.unit_id)
      .maybeSingle();
    if (unitError) {
      console.error(`Failed to load unit ${task.unit_id} for task ${task.id}`, unitError);
    } else {
      unit = data as typeof unit;
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
  const unitLabel = unit?.unit_number || unit?.unit_name || null;
  const kindLabel = taskKindLabel(task.task_kind);
  const referenceLabel = task.buildium_task_id ? `#${task.buildium_task_id}` : `#${task.id.slice(0, 6)}`;

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
    new: 'border-amber-200 bg-amber-50 text-amber-700',
    in_progress: 'border-sky-200 bg-sky-50 text-sky-700',
    completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    on_hold: 'border-slate-200 bg-slate-100 text-slate-700',
    cancelled: 'border-border bg-muted/60 text-muted-foreground',
  };
  const priorityTone: Record<TaskPriorityKey, string> = {
    low: 'bg-slate-200 text-slate-700',
    normal: 'bg-amber-200 text-amber-800',
    high: 'bg-orange-200 text-orange-800',
    urgent: 'bg-rose-200 text-rose-800',
  };
  const priorityDotTone: Record<TaskPriorityKey, string> = {
    low: 'bg-slate-400',
    normal: 'bg-amber-400',
    high: 'bg-orange-500',
    urgent: 'bg-rose-600',
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Link href="/tasks" className="hover:text-foreground">
              Tasks
            </Link>
            <span>/</span>
            <span>{referenceLabel}</span>
          </div>
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">
            {task.subject || 'Untitled task'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {kindLabel}
            {task.buildium_task_id ? ` • ${referenceLabel}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <CircleHelp className="size-4" aria-hidden />
            Help
          </Button>
          <Button className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90">
            Update task
          </Button>
          <Button variant="outline" size="icon" className="border-border/70">
            <MoreHorizontal className="size-4" aria-hidden />
            <span className="sr-only">More actions</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2">
            <CalendarDays className="size-4" aria-hidden />
            Due date: {dueDateLabel}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="size-4" aria-hidden />
            Created {createdLabel}
          </span>
        </div>
        <span>Last updated: {updatedLabel}{updatedRelativeLabel ? ` (${updatedRelativeLabel})` : ''}</span>
      </div>

      <Tabs defaultValue="summary" className="space-y-6">
        <div className="border-b border-border/70">
          <TabsList className="bg-transparent p-0">
            <TabsTrigger
              value="summary"
              className="rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors data-[state=inactive]:text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="work-orders"
              disabled
              className="rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            >
              Work orders
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="summary" className="space-y-6 focus-visible:outline-none">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-6">
              <Card className="border border-border/70 shadow-sm">
                <CardContent className="space-y-6 p-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Status</p>
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
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Priority</p>
                      <div className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
                        <span className={`size-2.5 rounded-full ${priorityDotTone[priorityMeta.key]}`} aria-hidden />
                        <span
                          className={`rounded-full px-2 py-1 ${priorityTone[priorityMeta.key]}`}
                        >
                          {priorityMeta.label}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Due date</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{dueDateLabel}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">
                        {kindLabel} {unitLabel ? `• ${unitLabel}` : ''}
                      </p>
                      {propertyName ? (
                        <p className="flex flex-wrap items-center gap-2">
                          <Link href={`/properties/${property?.id}`} className="text-primary hover:underline">
                            {propertyName}
                          </Link>
                          {unitLabel ? (
                            <>
                              <span>•</span>
                              <span>{unitLabel}</span>
                            </>
                          ) : null}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">No property linked</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-widest text-muted-foreground">Category</p>
                      <p className="text-sm">{task.category || 'Uncategorized'}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-6">
                    <h3 className="text-sm font-semibold text-foreground">Description</h3>
                    <p className="text-muted-foreground mt-2 text-sm leading-6">
                      {task.description?.trim() || 'No description provided for this task.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border border-border/70 shadow-sm">
                <CardHeader className="pb-0">
                  <CardTitle>Custom fields</CardTitle>
                  <CardAction>
                    <Button variant="ghost" size="sm" className="gap-1 px-2">
                      Add custom field
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="py-6">
                  <p className="text-muted-foreground text-sm">
                    You do not have any custom fields created to track additional information for this
                    task.
                  </p>
                </CardContent>
              </Card>

              <Card className="border border-border/70 shadow-sm">
                <CardHeader className="pb-0">
                  <CardTitle>Files</CardTitle>
                  <CardAction>
                    <Button variant="ghost" size="sm" className="gap-1 px-2">
                      Add attachments
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="py-6">
                  {hasFiles ? (
                    <div>Files go here.</div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No files added yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/70 shadow-sm">
                <CardHeader className="pb-0">
                  <CardTitle>Linked tasks</CardTitle>
                  <CardAction>
                    <Button variant="ghost" size="sm" className="gap-1 px-2">
                      Link tasks
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="py-6">
                  {hasLinkedTasks ? (
                    <div>Linked tasks go here.</div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No linked tasks yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="border border-border/70 shadow-sm">
                <CardHeader className="pb-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Updates</CardTitle>
                      <CardDescription>Latest activity on this task.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 border-border/70">
                      <Plus className="size-4" aria-hidden />
                      Add update
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 py-6">
                  <div className="relative space-y-6">
                    {updates.map((entry, index) => (
                      <div key={entry.id} className="relative pl-8">
                        <span className="absolute left-0 top-1.5 size-2 rounded-full bg-primary" />
                        {index < updates.length - 1 ? (
                          <span className="absolute left-[3px] top-4 h-full w-px bg-border" aria-hidden />
                        ) : null}
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">{entry.title}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{entry.timestamp}</span>
                            <span>•</span>
                            <span>{entry.relative}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <Badge
                              variant="outline"
                              className={`rounded-full border px-3 py-1 text-[11px] font-medium ${statusBadgeTone[entry.statusKey]}`}
                            >
                              {entry.status}
                            </Badge>
                            {entry.assignedTo ? <span>Assigned to {entry.assignedTo}</span> : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle>Location</CardTitle>
                  <CardDescription>Where this issue lives.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {propertyName ? (
                    <>
                      <div className="space-y-1 text-sm">
                        <p className="font-semibold text-foreground">{propertyName}</p>
                        {unitLabel ? <p className="text-muted-foreground">Unit {unitLabel}</p> : null}
                      </div>
                      <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4 text-sm whitespace-pre-line">
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

              <Card className="border border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle>Assignees</CardTitle>
                  <CardDescription>Manage who’s responsible.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/70 bg-muted/40 p-1 text-sm font-medium text-muted-foreground">
                    <div className="rounded-md bg-white px-3 py-2 text-foreground shadow-sm">Staff</div>
                    <div className="rounded-md px-3 py-2">Vendors</div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-white p-4 shadow-sm">
                    {assignedTo ? (
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10 border border-border/70">
                          <AvatarFallback className="bg-orange-100 text-orange-700 text-sm font-medium">
                            {assignedInitials || '??'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium text-foreground">{assignedTo}</p>
                          <p className="text-xs text-muted-foreground">Staff member</p>
                        </div>
                        <Button variant="ghost" size="sm" className="ml-auto px-2 text-sm">
                          Edit
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>No staff assigned to this task.</p>
                        <Button variant="ghost" size="sm" className="px-2 text-sm">
                          Add staff
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                    Add collaborators you want to notify.
                  </div>
                  <Button variant="outline" size="sm" className="w-full border-border/70">
                    Email staff
                  </Button>
                </CardContent>
              </Card>

              <Card className="border border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle>Contacts</CardTitle>
                  <CardDescription>People involved with this request.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border/70 bg-white p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      Requested by
                    </p>
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {task.requested_by_type
                        ? task.requested_by_type.replace(/_/g, ' ')
                        : 'Not provided'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ID:{' '}
                      {task.requested_by_contact_id
                        ? task.requested_by_contact_id
                        : task.requested_by_buildium_id
                        ? task.requested_by_buildium_id
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                    Add owner or tenant contacts to message them quickly.
                  </div>
                  <Button variant="outline" size="sm" className="w-full border-border/70">
                    Email contacts
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="work-orders" className="focus-visible:outline-none">
          <Card className="border border-border/70 shadow-sm">
            <CardContent className="py-6">
              <p className="text-muted-foreground text-sm">
                Linked work orders will appear here once available.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  );
}
