'use client';

import { useRouter } from 'next/navigation';
import type { SyntheticEvent } from 'react';
import { ChevronDown, CircleHelp, Download } from 'lucide-react';

import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  NavTabs,
  NavTabsContent,
  NavTabsHeader,
  NavTabsList,
  NavTabsTrigger,
} from '@/components/ui/nav-tabs';
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
import { cn } from '@/components/ui/utils';
import { TableRowLink } from '@/components/ui/table-row-link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FilterOption, SerializedTask } from '@/app/(protected)/tasks/page';
import type { TaskPriorityKey, TaskStatusKey } from '@/lib/tasks/utils';

const STATUS_BADGE_STYLES: Record<TaskStatusKey, string> = {
  new: 'status-pill-warning',
  in_progress: 'status-pill-info',
  completed: 'status-pill-success',
  on_hold: 'status-pill-warning',
  cancelled: 'status-pill-danger',
};

const PRIORITY_DOT_STYLES: Record<TaskPriorityKey, string> = {
  low: 'bg-muted-foreground',
  normal: 'bg-warning-600',
  high: 'bg-danger-500',
  urgent: 'bg-danger-700',
};

type TasksPageContentProps = {
  tasks: SerializedTask[];
  propertyFilterOptions: FilterOption[];
  statusFilterOptions: FilterOption[];
};

export default function TasksPageContent({
  tasks,
  propertyFilterOptions,
  statusFilterOptions,
}: TasksPageContentProps) {
  const matchLabel = tasks.length === 1 ? 'match' : 'matches';
  const defaultPropertyValue = propertyFilterOptions[0]?.id ?? 'all-properties';
  const defaultStatusValue = statusFilterOptions[0]?.id ?? 'all-statuses';
  const preventRowNavigation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };
  const router = useRouter();
  const addTaskOptions = [
    { value: 'todo', label: 'To do', href: '/tasks/new/to-do' },
    { value: 'resident_request', label: 'Resident request', href: '/tasks/new/resident' },
    { value: 'owner_request', label: 'Rental owner request', href: '/tasks/new/owner' },
    { value: 'contact_request', label: 'Contact request', href: '/tasks/new/contact' },
  ];

  return (
    <PageShell>
      <PageHeader
        title="Tasks"
        description="Track maintenance work and resident requests across your portfolio."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm">
                  Add task
                  <ChevronDown className="ml-1.5 size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px]">
                {addTaskOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    className="text-foreground"
                    onSelect={() => {
                      if (option.href) router.push(option.href);
                    }}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => router.push('/tasks/categories')}
            >
              Manage categories
            </Button>
            <Button type="button" size="sm" variant="outline">
              Notification settings
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
            >
              <CircleHelp className="size-4" aria-hidden />
              Help
            </Button>
          </>
        }
      />

      <PageBody>
        <section className="space-y-6">
          <NavTabs defaultValue="tasks" className="space-y-4">
            <NavTabsHeader className="border-border/70">
              <NavTabsList>
                <NavTabsTrigger value="tasks">Tasks</NavTabsTrigger>
                <NavTabsTrigger value="analytics" disabled>
                  Analytics
                </NavTabsTrigger>
              </NavTabsList>
            </NavTabsHeader>

            <NavTabsContent value="tasks" className="space-y-4 focus-visible:outline-none">
              <Card className="border-border/70 border shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="border-border/70 flex flex-wrap items-center gap-3 border-b px-6 py-4">
                    <Select defaultValue={defaultPropertyValue}>
                      <SelectTrigger className="min-w-[200px] sm:w-[220px]">
                        <SelectValue placeholder="All properties" />
                      </SelectTrigger>
                      <SelectContent>
                        {propertyFilterOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select defaultValue={defaultStatusValue}>
                      <SelectTrigger className="min-w-[220px] sm:w-[260px]">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusFilterOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3"
                    >
                      Add filter option
                      <ChevronDown className="size-4" aria-hidden />
                    </Button>
                  </div>

                  <div className="border-border/70 flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3 text-sm text-muted-foreground">
                    <span>
                      {tasks.length} {matchLabel}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground flex items-center gap-2 px-3"
                    >
                      <Download className="size-4" aria-hidden />
                      Export
                    </Button>
                  </div>

                  <Table className="min-w-[1100px]">
                    <TableHeader className="[&_th]:px-5 [&_th]:py-3">
                      <TableRow className="border-border/70 bg-muted/40 text-muted-foreground border-b text-[11px] font-semibold uppercase tracking-widest">
                        <TableHead className="w-12 pl-4">
                          <Checkbox aria-label="Select all tasks" />
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Age</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Vendors</TableHead>
                        <TableHead>Assignees</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="[&_td]:px-5 [&_td]:py-4">
                      {tasks.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={12}
                            className="text-muted-foreground py-12 text-center text-sm"
                          >
                            No tasks found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        tasks.map((task) => (
                          <TableRowLink
                            key={task.id}
                            href={`/tasks/${task.id}`}
                            className="border-border/70 bg-background hover:bg-muted/40 border-b transition-colors last:border-0"
                          >
                            <TableCell className="w-12 align-top">
                              <Checkbox
                                aria-label={`Select task ${task.subject}`}
                                onClick={preventRowNavigation}
                                onKeyDown={preventRowNavigation}
                              />
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'status-pill font-medium capitalize',
                                  STATUS_BADGE_STYLES[task.statusKey],
                                )}
                              >
                                {task.statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {task.dueDateLabel}
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex flex-col gap-1">
                                <span className="text-primary leading-5 font-medium">
                                  {task.subject}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                  {task.propertyName
                                    ? task.unitLabel
                                      ? `${task.propertyName} • ${task.unitLabel}`
                                      : task.propertyName
                                    : '—'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground align-top text-sm">
                              {task.unitLabel || '—'}
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              <p>{task.updatedAtLabel}</p>
                              <p className="text-muted-foreground text-xs">
                                {task.updatedRelativeLabel}
                              </p>
                            </TableCell>
                            <TableCell className="align-top text-sm">{task.ageLabel}</TableCell>
                            <TableCell className="align-top text-sm">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    'size-2.5 rounded-full',
                                    PRIORITY_DOT_STYLES[task.priorityKey],
                                  )}
                                  aria-hidden
                                />
                                <span>{task.priorityLabel}</span>
                              </div>
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {task.categoryLabel}
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              {task.vendorLabel || '—'}
                            </TableCell>
                            <TableCell className="align-top">
                              {task.assignedToLabel ? (
                                <div className="flex items-center gap-2">
                                  <Avatar className="border-border/60 size-8 border">
                                    <AvatarFallback className="bg-orange-100 text-xs font-medium text-orange-700">
                                      {task.assignedToInitials || '??'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-muted-foreground text-sm">
                                    {task.assignedToLabel}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="align-top text-sm">
                              <button
                                type="button"
                                className="text-primary font-medium hover:underline"
                                onClick={preventRowNavigation}
                              >
                                Update
                              </button>
                            </TableCell>
                          </TableRowLink>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </NavTabsContent>

            <NavTabsContent
              value="analytics"
              className="text-muted-foreground text-sm focus-visible:outline-none"
            >
              Analytics coming soon.
            </NavTabsContent>
          </NavTabs>
        </section>
      </PageBody>
    </PageShell>
  );
}
