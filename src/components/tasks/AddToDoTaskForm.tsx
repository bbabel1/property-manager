"use client";

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/utils';
import {
  TaskPriorityKey,
  TaskStatusKey,
  normalizeTaskPriority,
  normalizeTaskStatus,
} from '@/lib/tasks/utils';

type Option = { id: string; label: string };

type Props = {
  categoryOptions: Option[];
  propertyOptions: Option[];
  staffOptions: Option[];
};

type FormState = {
  subject: string;
  description: string;
  categoryId: string;
  propertyId: string;
  assignedToId: string;
  collaboratorIds: string[];
  status: TaskStatusKey;
  dueDate: string | null;
  priority: TaskPriorityKey;
  sharingStaff: boolean;
};

const STATUS_OPTIONS: Array<{ value: TaskStatusKey; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PRIORITY_OPTIONS: Array<{ value: TaskPriorityKey; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const addTaskLinks = [
  { label: 'To do', href: '/tasks/new/to-do' },
  { label: 'Resident request', href: '/tasks/new/resident' },
  { label: 'Rental owner request', href: '/tasks/new/owner' },
  { label: 'Contact request', href: '/tasks/new/contact' },
];

export default function AddToDoTaskForm({
  categoryOptions,
  propertyOptions,
  staffOptions,
}: Props) {
  const router = useRouter();
  const initialAssignedTo = staffOptions[0]?.id || '';
  const [formState, setFormState] = useState<FormState>({
    subject: '',
    description: '',
    categoryId: '',
    propertyId: '',
    assignedToId: initialAssignedTo,
    collaboratorIds: [],
    status: 'new',
    dueDate: null,
    priority: 'normal',
    sharingStaff: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const collaboratorLabels = useMemo(() => {
    if (!formState.collaboratorIds.length) return 'Select collaborators to include...';
    if (formState.collaboratorIds.length === 1) {
      const option = staffOptions.find((staff) => staff.id === formState.collaboratorIds[0]);
      return option?.label || '1 collaborator selected';
    }
    return `${formState.collaboratorIds.length} collaborators selected`;
  }, [formState.collaboratorIds, staffOptions]);

  const handleFileAdd = (files: FileList | null) => {
    if (!files?.length) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.subject.trim()) {
      toast.error('Subject is required.');
      return;
    }
    if (!formState.assignedToId) {
      toast.error('Assigned to is required.');
      return;
    }

    try {
      setIsSaving(true);
      await new Promise((resolve) => setTimeout(resolve, 650));
      toast.success('Task created (demo)');
      router.push('/tasks');
    } catch (error) {
      console.error('Failed to create task', error);
      toast.error('Something went wrong while creating the task.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6 pb-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Add to do</h1>
        <p className="text-muted-foreground text-sm">
          Capture the task details, assign the right teammates, and keep everyone in the loop.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <Card className="border border-border/70 shadow-sm">
          <CardContent className="space-y-8 p-8">
            <section className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="task-subject" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Subject <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="task-subject"
                    placeholder="Summarize the task"
                    value={formState.subject}
                    onChange={(event) => updateField('subject', event.target.value)}
                    required
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-description" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Description
                  </Label>
                  <Textarea
                    id="task-description"
                    placeholder="Add context or instructions..."
                    value={formState.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    className="min-h-[140px] resize-y"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-sm font-medium"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                >
                  + Add attachments...
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => handleFileAdd(event.target.files)}
                />
                {attachments.length ? (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border border-dashed border-border/70 px-3 py-2 text-sm">
                        <span className="truncate pr-3 text-foreground">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-destructive px-2"
                          onClick={() => handleRemoveAttachment(index)}
                          disabled={isSaving}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Category
                </Label>
                <Select
                  value={formState.categoryId}
                  onValueChange={(value) => updateField('categoryId', value)}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.length ? (
                      categoryOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__empty" disabled>
                        No categories available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Property
                </Label>
                <Select
                  value={formState.propertyId}
                  onValueChange={(value) => updateField('propertyId', value === '__clear' ? '' : value)}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a property..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear">No property</SelectItem>
                    {propertyOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Assigned to <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formState.assignedToId}
                  onValueChange={(value) => updateField('assignedToId', value)}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a staff member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staffOptions.length ? (
                      staffOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="__no_staff" disabled>
                        No staff members available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Collaborators
                </Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 justify-between px-3 text-left font-normal"
                      disabled={isSaving}
                    >
                      <span className="truncate">{collaboratorLabels}</span>
                      <ChevronDown className="ml-2 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[240px]">
                    {staffOptions.length ? (
                      staffOptions.map((option) => {
                        const checked = formState.collaboratorIds.includes(option.id);
                        return (
                          <DropdownMenuCheckboxItem
                            key={option.id}
                            checked={checked}
                            onCheckedChange={(next) => {
                              setFormState((prev) => {
                                const nextCollaborators = next
                                  ? [...prev.collaboratorIds, option.id]
                                  : prev.collaboratorIds.filter((id) => id !== option.id);
                                return { ...prev, collaboratorIds: nextCollaborators };
                              });
                            }}
                          >
                            {option.label}
                          </DropdownMenuCheckboxItem>
                        );
                      })
                    ) : (
                      <DropdownMenuItem disabled>No staff available</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </Label>
                <Select
                  value={formState.status}
                  onValueChange={(value) => updateField('status', value as TaskStatusKey)}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {normalizeTaskStatus(option.value).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Due date
                </Label>
                <DatePicker
                  value={formState.dueDate}
                  onChange={(value) => updateField('dueDate', value)}
                  placeholder="MM/DD/YYYY"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Priority
                </Label>
                <Select
                  value={formState.priority}
                  onValueChange={(value) => updateField('priority', value as TaskPriorityKey)}
                  disabled={isSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {normalizeTaskPriority(option.value).label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <Button type="button" variant="link" className="px-0 text-sm font-medium">
                  + Add to project
                </Button>
              </div>
              <Card className="border border-border/70 bg-muted/40">
                <CardContent className="space-y-4 p-5">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Sharing</p>
                    <p className="text-xs text-muted-foreground">
                      Keep the right people informed by telling them what&apos;s changed.
                    </p>
                  </div>
                  <div
                    className={cn(
                      'flex items-start gap-3 rounded-lg border px-4 py-3',
                      formState.sharingStaff ? 'border-primary/40 bg-primary/5' : 'border-border/70',
                    )}
                  >
                    <CheckCircle2
                      className={cn('mt-0.5 size-5', formState.sharingStaff ? 'text-primary' : 'text-muted-foreground')}
                      aria-hidden
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">Staff</p>
                        {formState.sharingStaff ? (
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            Enabled
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Email staff members who opted into task notifications.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Creating...' : 'Create task'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" className="text-primary">
                Add another task
                <ChevronDown className="ml-2 size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {addTaskLinks.map((link) => (
                <DropdownMenuItem key={link.href} onSelect={() => router.push(link.href)}>
                  {link.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" variant="ghost" onClick={() => router.push('/tasks')} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
