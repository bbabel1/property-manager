'use client';

import { useRouter } from 'next/navigation';
import type { SyntheticEvent } from 'react';
import { ChevronDown, CircleHelp, Download } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  new: 'border-[var(--color-warning-500)] bg-[var(--color-warning-50)] text-[var(--color-warning-600)]',
  in_progress: 'border-[var(--color-action-200)] bg-[var(--color-action-50)] text-[var(--color-action-700)]',
  completed:
    'border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]',
  on_hold: 'border-[var(--color-gray-300)] bg-[var(--color-gray-50)] text-[var(--color-gray-700)]',
  cancelled: 'border-[var(--color-gray-300)] bg-[var(--color-gray-50)] text-[var(--color-gray-600)]',
};

const PRIORITY_DOT_STYLES: Record<TaskPriorityKey, string> = {
  low: 'bg-[var(--color-gray-400)]',
  normal: 'bg-[var(--color-warning-600)]',
  high: 'bg-[var(--color-danger-500)]',
  urgent: 'bg-[var(--color-danger-700)]',
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
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">All tasks</h1>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-2 px-3"
          >
            <CircleHelp className="size-4" aria-hidden />
            Help
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
              >
                Add task
                <ChevronDown className="ml-2 size-4" aria-hidden />
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
            variant="outline"
            className="border-border/80 shadow-sm"
            onClick={() => router.push('/tasks/categories')}
          >
            Manage categories
          </Button>
          <Button type="button" variant="outline" className="border-border/80 shadow-sm">
            Notification settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tasks" className="space-y-4">
        <div className="border-b border-border/70">
          <TabsList className="bg-transparent p-0 flex gap-6">
            <TabsTrigger
              value="tasks"
              className={cn(
                'border-b-2 border-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground',
                'data-[state=active]:border-primary data-[state=active]:text-foreground',
              )}
            >
              Tasks
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              disabled
              className={cn(
                'border-b-2 border-transparent px-1 pb-3 pt-2 text-sm font-medium transition-colors',
                'data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground',
                'data-[state=active]:border-primary data-[state=active]:text-foreground',
              )}
            >
              Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tasks" className="space-y-4 focus-visible:outline-none">
          <Card className="border-border/70 border shadow-sm">
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

              <div className="overflow-auto">
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
                                'rounded-full border px-3 py-1 text-xs font-medium capitalize',
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="analytics"
          className="text-muted-foreground text-sm focus-visible:outline-none"
        >
          Analytics coming soon.
        </TabsContent>
      </Tabs>
    </section>
  );
}
