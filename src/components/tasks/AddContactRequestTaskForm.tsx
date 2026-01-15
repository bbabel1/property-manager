"use client";

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Body, Heading, Label } from '@/ui/typography';

type Option = { id: string; label: string };

type Props = {
  categoryOptions: Option[];
  propertyOptions: Option[];
  staffOptions: Option[];
};

type FormState = {
  firstName: string;
  lastName: string;
  homePhone: string;
  mobilePhone: string;
  email: string;
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

export default function AddContactRequestTaskForm({
  categoryOptions,
  propertyOptions,
  staffOptions,
}: Props) {
  const router = useRouter();
  const initialAssignedTo = staffOptions[0]?.id || '';
  const [formState, setFormState] = useState<FormState>({
    firstName: '',
    lastName: '',
    homePhone: '',
    mobilePhone: '',
    email: '',
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

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileAdd = (files: FileList | null) => {
    if (!files?.length) return;
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.firstName.trim() || !formState.lastName.trim()) {
      toast.error('First and last name are required.');
      return;
    }
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
      toast.success('Contact request created (demo)');
      router.push('/tasks');
    } catch (error) {
      console.error('Failed to create contact task', error);
      toast.error('Something went wrong while creating the task.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6 pb-12">
      <div className="space-y-2">
        <Heading as="h1" size="h2">
          Add contact request
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Record the contact details and capture what needs attention so your team can follow up.
        </Body>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <Card className="border border-border/70 shadow-sm">
          <CardContent className="space-y-8 p-8">
            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-first-name" size="xs" tone="muted" className="uppercase tracking-wide">
                  First name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contact-first-name"
                  placeholder="Contact first name"
                  value={formState.firstName}
                  onChange={(event) => updateField('firstName', event.target.value)}
                  required
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-last-name" size="xs" tone="muted" className="uppercase tracking-wide">
                  Last name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contact-last-name"
                  placeholder="Contact last name"
                  value={formState.lastName}
                  onChange={(event) => updateField('lastName', event.target.value)}
                  required
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-home-phone" size="xs" tone="muted" className="uppercase tracking-wide">
                  Phone (home)
                </Label>
                <Input
                  id="contact-home-phone"
                  placeholder="(555) 123-4567"
                  value={formState.homePhone}
                  onChange={(event) => updateField('homePhone', event.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-mobile-phone" size="xs" tone="muted" className="uppercase tracking-wide">
                  Phone (mobile)
                </Label>
                <Input
                  id="contact-mobile-phone"
                  placeholder="(555) 123-4567"
                  value={formState.mobilePhone}
                  onChange={(event) => updateField('mobilePhone', event.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contact-email" size="xs" tone="muted" className="uppercase tracking-wide">
                  Email
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="contact@example.com"
                  value={formState.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  disabled={isSaving}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contact-task-subject" size="xs" tone="muted" className="uppercase tracking-wide">
                    Subject <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="contact-task-subject"
                    placeholder="Summarize the request"
                    value={formState.subject}
                    onChange={(event) => updateField('subject', event.target.value)}
                    required
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-task-description" size="xs" tone="muted" className="uppercase tracking-wide">
                    Description
                  </Label>
                  <Textarea
                    id="contact-task-description"
                    placeholder="Add any important details gathered from the contact..."
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
                  className="px-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSaving}
                >
                  <Body as="span" size="sm">
                    + Add attachments...
                  </Body>
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
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-md border border-dashed border-border/70 px-3 py-2">
                        <Body as="span" size="sm" className="truncate pr-3">
                          {file.name}
                        </Body>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="px-2 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveAttachment(index)}
                          disabled={isSaving}
                        >
                          <Body as="span" size="sm">
                            Remove
                          </Body>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label size="xs" tone="muted" className="uppercase tracking-wide">
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
                <Label size="xs" tone="muted" className="uppercase tracking-wide">
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
                <Label size="xs" tone="muted" className="uppercase tracking-wide">
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
                <Label size="xs" tone="muted" className="uppercase tracking-wide">
                  Collaborators
                </Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 justify-between px-3 text-left"
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
                <Label size="xs" tone="muted" className="uppercase tracking-wide">
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
                <Label size="xs" tone="muted" className="uppercase tracking-wide">
                  Due date
                </Label>
                <DatePicker
                  value={formState.dueDate}
                  onChange={(value) => updateField('dueDate', value)}
                  placeholder="MM/DD/YYYY"
                />
              </div>
              <div className="space-y-2">
                <Label size="xs" tone="muted" className="uppercase tracking-wide">
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
                <Button type="button" variant="link" className="px-0">
                  <Body as="span" size="sm">
                    + Add to project
                  </Body>
                </Button>
              </div>
              <Card className="border border-border/70 bg-muted/40">
                <CardContent className="space-y-4 p-5">
                  <div className="space-y-1">
                    <Label as="p">Sharing</Label>
                    <Body tone="muted" size="xs">
                      Keep the right people informed by telling them what&apos;s changed.
                    </Body>
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
                        <Label as="span" size="sm">
                          Staff
                        </Label>
                        {formState.sharingStaff ? (
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          Enabled
                        </Badge>
                        ) : null}
                      </div>
                      <Body as="p" tone="muted" size="xs">
                        Email staff members who opted into task notifications.
                      </Body>
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
