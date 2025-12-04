'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Bell, CalendarClock, ChevronDown, ChevronRight, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { RecurringTaskTemplate } from '@/components/monthly-logs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/components/ui/utils';

type RecurringTaskFormState = {
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number;
  dueAnchor: 'period_start' | 'period_end';
  dueOffsetDays: number;
  isActive: boolean;
  assignedStaffId: number | null;
  additionalStaffIds: number[];
  autoAssignManager: boolean;
  reminders: number[];
};

type StaffOption = { id: number; name: string };

type Props = {
  propertyId: string | null;
  unitId: string | null;
  propertyName?: string | null;
  unitLabel?: string | null;
  onOpenManager?: () => void;
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load recurring tasks');
  }
  return payload;
};

const defaultFormState: RecurringTaskFormState = {
  title: '',
  description: '',
  frequency: 'monthly',
  interval: 1,
  dueAnchor: 'period_end',
  dueOffsetDays: 0,
  isActive: true,
  assignedStaffId: null,
  additionalStaffIds: [],
  autoAssignManager: true,
  reminders: [],
};

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

export default function RecurringTasksForUnit({
  propertyId,
  unitId,
  propertyName,
  unitLabel,
  onOpenManager,
}: Props) {
  const [formState, setFormState] = useState<RecurringTaskFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reminderDraft, setReminderDraft] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const canManage = Boolean(propertyId && unitId);

  const {
    data: staffData,
    isLoading: staffLoading,
  } = useSWR<{ id: number; displayName?: string; email?: string }[]>(
    canManage ? '/api/staff?isActive=true' : null,
    fetcher,
  );

  const staffOptions: StaffOption[] = useMemo(() => {
    return (staffData || []).map((member) => ({
      id: member.id,
      name: member.displayName || member.email || `Staff ${member.id}`,
    }));
  }, [staffData]);

  const {
    data,
    isLoading,
    mutate,
  } = useSWR<{ items?: RecurringTaskTemplate[] }>(
    canManage
      ? `/api/monthly-logs/recurring-tasks?propertyId=${propertyId}&unitId=${unitId}`
      : null,
    fetcher,
    { keepPreviousData: true },
  );

  const tasks = data?.items ?? [];

  const headerLabel = useMemo(() => {
    if (unitLabel && propertyName) return `${unitLabel} • ${propertyName}`;
    if (unitLabel) return unitLabel;
    if (propertyName) return propertyName;
    return 'Recurring tasks';
  }, [propertyName, unitLabel]);

  const resetForm = () => {
    setFormState(defaultFormState);
    setEditingId(null);
    setReminderDraft('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || !propertyId || !unitId) {
      toast.error('Assign a property and unit to this monthly log first.');
      return;
    }
    if (!formState.title.trim()) {
      toast.error('Subject is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        propertyId,
        unitId,
        title: formState.title,
        description: formState.description || null,
        dueAnchor: formState.dueAnchor,
        dueOffsetDays: formState.dueOffsetDays,
        isActive: formState.isActive,
        frequency: formState.frequency,
        interval: formState.interval,
        assignedStaffId: formState.assignedStaffId,
        additionalStaffIds: formState.additionalStaffIds,
        autoAssignManager: formState.autoAssignManager,
        reminders: formState.reminders,
      };
      const response = await fetch(
        editingId
          ? `/api/monthly-logs/recurring-tasks/${editingId}`
          : '/api/monthly-logs/recurring-tasks',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const text = await response.text();
      const parsed = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(parsed?.error || 'Failed to save recurring task');
      }
      toast.success(editingId ? 'Recurring task updated.' : 'Recurring task added.');
      resetForm();
      await mutate();
    } catch (error) {
      console.error('Failed to save recurring task', error);
      toast.error((error as Error)?.message || 'Could not save recurring task');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (task: RecurringTaskTemplate) => {
    setEditingId(task.id);
    setFormState({
      title: task.title,
      description: task.description || '',
      frequency: (task.frequency as RecurringTaskFormState['frequency']) || 'monthly',
      interval: task.interval || 1,
      dueAnchor: task.dueAnchor,
      dueOffsetDays: task.dueOffsetDays,
      isActive: task.isActive,
      assignedStaffId: task.assignedStaffId,
      additionalStaffIds: task.additionalStaffIds || [],
      autoAssignManager: task.autoAssignManager,
      reminders: task.reminders || [],
    });
    setReminderDraft('');
  };

  const handleDelete = async (taskId: string) => {
    setDeletingId(taskId);
    try {
      const response = await fetch(`/api/monthly-logs/recurring-tasks/${taskId}`, {
        method: 'DELETE',
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete recurring task');
      }
      toast.success('Recurring task removed.');
      await mutate();
    } catch (error) {
      console.error('Failed to delete recurring task', error);
      toast.error((error as Error)?.message || 'Could not delete recurring task');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleAdditionalStaff = (id: number) => {
    setFormState((prev) => {
      const next = prev.additionalStaffIds.includes(id)
        ? prev.additionalStaffIds.filter((value) => value !== id)
        : [...prev.additionalStaffIds, id];
      return { ...prev, additionalStaffIds: next };
    });
  };

  const addReminder = () => {
    const value = Number(reminderDraft);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Reminder must be a non-negative number of days.');
      return;
    }
    setFormState((prev) => ({
      ...prev,
      reminders: Array.from(new Set([...prev.reminders, value])).sort((a, b) => a - b),
    }));
    setReminderDraft('');
  };

  const removeReminder = (value: number) => {
    setFormState((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((item) => item !== value),
    }));
  };

  const StaffSelect = ({
    value,
    onChange,
    placeholder,
  }: {
    value: number | null;
    onChange: (value: number | null) => void;
    placeholder: string;
  }) => (
    <Select
      value={value != null ? String(value) : ''}
      onValueChange={(val) => {
        if (val === 'none') onChange(null);
        else onChange(Number(val));
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Unassigned</SelectItem>
        {staffOptions.map((staff) => (
          <SelectItem key={staff.id} value={String(staff.id)}>
            {staff.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <section className="space-y-4 rounded-xl border border-border/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Recurring tasks</h3>
            <p className="text-xs text-muted-foreground">{headerLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenManager ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenManager} className="gap-2">
              Manage
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {expanded ? 'Hide' : 'Show'}
          </Button>
        </div>
      </div>

      {!canManage ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
          Assign a property and unit to this monthly log to start managing recurring tasks.
        </div>
      ) : null}

      {!expanded ? null : (
        <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-3">
          {tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
              No recurring tasks yet for this unit.
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-border/80 bg-background px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{task.title}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'rounded-full text-[11px] font-semibold',
                        task.isActive
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-border bg-muted/80 text-muted-foreground',
                      )}
                    >
                      {task.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => startEditing(task)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(task.id)}
                      disabled={deletingId === task.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {task.frequency ? `${task.frequency} • ` : ''}
                  Due {task.dueAnchor.replace('_', ' ')}
                  {task.dueOffsetDays ? ` • Offset ${task.dueOffsetDays}d` : ''}
                </div>
                {task.description ? (
                  <p className="mt-2 text-sm text-foreground/80">{task.description}</p>
                ) : null}
                {task.reminders.length ? (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Bell className="h-3.5 w-3.5" />
                    Reminders: {task.reminders.map((r) => `${r}d before`).join(', ')}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border/70 bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-semibold text-foreground">
                {editingId ? 'Edit recurring task' : 'Create recurring task'}
              </div>
              <p className="text-xs text-muted-foreground">
                Configure cadence, reminders, and assignment.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Subject
            </Label>
            <Input
              value={formState.title}
              onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="e.g., Reconcile bank statement"
              required
              disabled={!canManage}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Body
            </Label>
            <Textarea
              value={formState.description}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Optional checklist or notes"
              className="min-h-[90px]"
              disabled={!canManage}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Frequency
              </Label>
              <Select
                value={formState.frequency}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    frequency: value as RecurringTaskFormState['frequency'],
                  }))
                }
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose frequency" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Interval
              </Label>
              <Input
                type="number"
                min={1}
                value={formState.interval}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    interval: Number(event.target.value) || 1,
                  }))
                }
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Active
              </Label>
              <div className="flex h-10 items-center gap-3 rounded-lg border border-border/70 bg-white px-3">
                <Switch
                  checked={formState.isActive}
                  onCheckedChange={(checked) =>
                    setFormState((prev) => ({ ...prev, isActive: checked }))
                  }
                  id="recurring-inline-active"
                  disabled={!canManage}
                />
                <Label htmlFor="recurring-inline-active" className="text-sm font-medium text-foreground">
                  {formState.isActive ? 'Enabled' : 'Paused'}
                </Label>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Due anchor
              </Label>
              <Select
                value={formState.dueAnchor}
                onValueChange={(value) =>
                  setFormState((prev) => ({
                    ...prev,
                    dueAnchor: value as RecurringTaskFormState['dueAnchor'],
                  }))
                }
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose anchor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="period_start">Period start</SelectItem>
                  <SelectItem value="period_end">Period end</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Offset (days)
              </Label>
              <Input
                type="number"
                value={formState.dueOffsetDays}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, dueOffsetDays: Number(event.target.value) }))
                }
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Reminders
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Days before"
                  value={reminderDraft}
                  onChange={(event) => setReminderDraft(event.target.value)}
                  disabled={!canManage}
                />
                <Button type="button" variant="outline" size="sm" onClick={addReminder} disabled={!canManage}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formState.reminders.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No reminders added.</span>
                ) : (
                  formState.reminders.map((value) => (
                    <Badge
                      key={value}
                      variant="outline"
                      className="flex items-center gap-2 rounded-full border-border/80 text-[11px]"
                    >
                      {value}d before
                      <button
                        type="button"
                        className="text-destructive"
                        onClick={() => removeReminder(value)}
                      >
                        ×
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Assigned staff
              </Label>
              <StaffSelect
                value={formState.assignedStaffId}
                onChange={(id) => setFormState((prev) => ({ ...prev, assignedStaffId: id }))}
                placeholder={staffLoading ? 'Loading staff...' : 'Choose staff'}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  id="inline-auto-assign-pm"
                  checked={formState.autoAssignManager}
                  onCheckedChange={(checked) =>
                    setFormState((prev) => ({ ...prev, autoAssignManager: checked }))
                  }
                  disabled={!canManage}
                />
                <Label htmlFor="inline-auto-assign-pm">Auto-assign property manager</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Additional staff
              </Label>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-border/70 bg-white p-2">
                {staffOptions.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No staff available.</div>
                ) : (
                  staffOptions.map((staff) => (
                    <label
                      key={staff.id}
                      className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted/60"
                    >
                      <span>{staff.name}</span>
                      <input
                        type="checkbox"
                        checked={formState.additionalStaffIds.includes(staff.id)}
                        onChange={() => toggleAdditionalStaff(staff.id)}
                        className="accent-primary"
                        disabled={!canManage}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!canManage || saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add recurring task'}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" onClick={resetForm} disabled={saving}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
        </div>
      )}
    </section>
  );
}
