'use client';

import { useState } from 'react';
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
  propertyName: _propertyName,
  unitLabel: _unitLabel,
  onOpenManager: _onOpenManager,
}: Props) {
  const [formState, setFormState] = useState<RecurringTaskFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const canManage = Boolean(propertyId && unitId);

  const { data, mutate } = useSWR<{ items?: RecurringTaskTemplate[] }>(
    canManage
      ? `/api/monthly-logs/recurring-tasks?propertyId=${propertyId}&unitId=${unitId}`
      : null,
    fetcher,
    { keepPreviousData: true },
  );

  const tasks = data?.items ?? [];

  const resetForm = () => {
    setFormState(defaultFormState);
    setEditingId(null);
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

  return (
    <section className="rounded-lg border border-slate-300 bg-slate-100 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-slate-700" />
          <h3 className="text-sm font-medium text-slate-900">Recurring tasks</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex h-7 items-center gap-1 text-xs text-slate-700 hover:bg-slate-200 hover:text-slate-900"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {expanded ? 'Hide' : 'Show'}
        </Button>
      </div>

      {expanded && (
        <>
          <div className="mt-3 space-y-2">
            {!canManage ? (
              <div className="rounded border border-dashed border-slate-400 bg-slate-100 p-3 text-xs text-slate-600">
                Assign a property and unit to manage recurring tasks.
              </div>
            ) : tasks.length === 0 ? (
              <div className="rounded border border-dashed border-slate-400 bg-slate-100 p-3 text-xs text-slate-600">
                No recurring tasks yet for this unit.
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded border border-slate-300 bg-white p-2.5 transition hover:border-slate-400 hover:bg-slate-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-900">{task.title}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'status-pill px-1.5 py-0 text-[10px] font-medium',
                            task.isActive
                              ? 'border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]'
                              : 'border-slate-300 bg-slate-100 text-slate-600',
                          )}
                        >
                          {task.isActive ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      <div className="mt-1 text-xs text-slate-600">
                        {task.frequency ? `${task.frequency} • ` : ''}
                        Due {task.dueAnchor.replace('_', ' ')}
                        {task.dueOffsetDays ? ` • Offset ${task.dueOffsetDays}d` : ''}
                      </div>
                      {task.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-700">
                          {task.description}
                        </p>
                      )}
                      {task.reminders.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                          <Bell className="h-3 w-3" />
                          {task.reminders.map((r) => `${r}d before`).join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                        onClick={() => startEditing(task)}
                      >
                        <span className="text-xs">Edit</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 w-7 p-0 hover:bg-red-50"
                        onClick={() => handleDelete(task.id)}
                        disabled={deletingId === task.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {canManage && (
            <form
              onSubmit={handleSubmit}
              className="mt-3 space-y-3 rounded-lg border border-slate-300 bg-white p-3"
            >
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-slate-600" />
                <div className="text-xs font-medium text-slate-900">
                  {editingId ? 'Edit recurring task' : 'Create recurring task'}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Subject</Label>
                  <Input
                    value={formState.title}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, title: event.target.value }))
                    }
                    placeholder="e.g., Reconcile bank statement"
                    required
                    disabled={!canManage}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Frequency</Label>
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
                    <SelectTrigger className="h-8 text-sm">
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
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-700">Description</Label>
                <Textarea
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Optional checklist or notes"
                  className="min-h-[60px] text-sm"
                  disabled={!canManage}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <Label className="text-xs font-medium text-slate-700">Due anchor</Label>
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
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Choose anchor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="period_start">Period start</SelectItem>
                      <SelectItem value="period_end">Period end</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-700">Offset (days)</Label>
                  <Input
                    type="number"
                    value={formState.dueOffsetDays}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        dueOffsetDays: Number(event.target.value),
                      }))
                    }
                    disabled={!canManage}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={formState.isActive}
                    onCheckedChange={(checked) =>
                      setFormState((prev) => ({ ...prev, isActive: checked }))
                    }
                    id="recurring-inline-active"
                    disabled={!canManage}
                  />
                  <Label
                    htmlFor="recurring-inline-active"
                    className="text-xs font-medium text-slate-700"
                  >
                    {formState.isActive ? 'Active' : 'Paused'}
                  </Label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canManage || saving}
                  className="h-8 text-xs"
                >
                  {saving ? 'Saving…' : editingId ? 'Save' : 'Add'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetForm}
                    disabled={saving}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
