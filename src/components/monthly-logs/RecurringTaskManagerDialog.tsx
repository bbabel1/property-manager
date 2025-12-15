'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { ArrowRight, Bell, CalendarClock, ShieldCheck, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

import type { RecurringTaskTemplate } from '@/components/monthly-logs/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

type PropertyOption = { id: string; name: string };
type UnitOption = { id: string; propertyId: string; label: string };
type StaffOption = { id: number; name: string };

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

type ViewStep = 'select' | 'manage';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: PropertyOption[];
  units: UnitOption[];
  initialPropertyId?: string | null;
  initialUnitId?: string | null;
};

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(payload?.error || 'Request failed');
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

export default function RecurringTaskManagerDialog({
  open,
  onOpenChange,
  properties,
  units,
  initialPropertyId,
  initialUnitId,
}: Props) {
  const [view, setView] = useState<ViewStep>('select');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [createState, setCreateState] = useState<RecurringTaskFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<RecurringTaskFormState>(defaultFormState);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reminderDraft, setReminderDraft] = useState<string>('');

  const propertyOptions = useMemo(
    () => properties.map((p) => ({ value: p.id, label: p.name })),
    [properties],
  );
  const unitOptions = useMemo(
    () => units.filter((unit) => unit.propertyId === selectedPropertyId),
    [units, selectedPropertyId],
  );

  useEffect(() => {
    if (!open) {
      setView('select');
      setEditingId(null);
      setCreateState(defaultFormState);
      setSelectedPropertyId('');
      setSelectedUnitId('');
      return;
    }
    if (initialPropertyId) setSelectedPropertyId(initialPropertyId);
    if (initialUnitId) setSelectedUnitId(initialUnitId);
  }, [open, initialPropertyId, initialUnitId]);

  useEffect(() => {
    if (selectedPropertyId && !unitOptions.some((u) => u.id === selectedUnitId)) {
      setSelectedUnitId('');
      setView('select');
    }
  }, [selectedPropertyId, selectedUnitId, unitOptions]);

  const { data: staffData, isLoading: staffLoading } = useSWR<
    { id: number; displayName?: string; email?: string }[]
  >(open ? '/api/staff?isActive=true' : null, fetcher);

  const staffOptions: StaffOption[] = useMemo(() => {
    return (staffData || []).map((member) => ({
      id: member.id,
      name: member.displayName || member.email || `Staff ${member.id}`,
    }));
  }, [staffData]);

  const { data, isLoading, mutate } = useSWR<{ items?: RecurringTaskTemplate[] }>(
    selectedPropertyId && selectedUnitId
      ? `/api/monthly-logs/recurring-tasks?propertyId=${selectedPropertyId}&unitId=${selectedUnitId}`
      : null,
    fetcher,
    { keepPreviousData: true },
  );

  const tasks = data?.items ?? [];

  const selectedPropertyName =
    properties.find((property) => property.id === selectedPropertyId)?.name ?? 'Property';
  const selectedUnitLabel =
    units.find((unit) => unit.id === selectedUnitId)?.label ?? 'Select a unit';

  const goManage = () => {
    if (selectedPropertyId && selectedUnitId) {
      setView('manage');
    } else {
      toast.error('Choose a property and unit to continue.');
    }
  };

  const handleCreate = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedPropertyId || !selectedUnitId) {
        toast.error('Select a property and unit first.');
        return;
      }
      if (!createState.title.trim()) {
        toast.error('Subject is required for recurring tasks.');
        return;
      }
      setSaving(true);
      try {
        const response = await fetch('/api/monthly-logs/recurring-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId: selectedPropertyId,
            unitId: selectedUnitId,
            title: createState.title,
            description: createState.description || null,
            dueAnchor: createState.dueAnchor,
            dueOffsetDays: createState.dueOffsetDays,
            isActive: createState.isActive,
            frequency: createState.frequency,
            interval: createState.interval,
            assignedStaffId: createState.assignedStaffId,
            additionalStaffIds: createState.additionalStaffIds,
            autoAssignManager: createState.autoAssignManager,
            reminders: createState.reminders,
          }),
        });
        const text = await response.text();
        const payload = text ? JSON.parse(text) : {};
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to create recurring task');
        }
        toast.success('Recurring task created.');
        setCreateState(defaultFormState);
        await mutate();
      } catch (error) {
        console.error('Failed to create recurring task', error);
        toast.error((error as Error)?.message || 'Could not create recurring task');
      } finally {
        setSaving(false);
      }
    },
    [createState, mutate, selectedPropertyId, selectedUnitId],
  );

  const startEditing = (task: RecurringTaskTemplate) => {
    setEditingId(task.id);
    setEditingState({
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

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingId) return;
    try {
      const response = await fetch(`/api/monthly-logs/recurring-tasks/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingState),
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : {};
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update recurring task');
      }
      toast.success('Recurring task updated.');
      setEditingId(null);
      await mutate();
    } catch (error) {
      console.error('Failed to update recurring task', error);
      toast.error((error as Error)?.message || 'Could not update recurring task');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!taskId) return;
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

  const toggleAdditionalStaff = (id: number, target: 'create' | 'edit') => {
    if (target === 'create') {
      setCreateState((prev) => {
        const next = prev.additionalStaffIds.includes(id)
          ? prev.additionalStaffIds.filter((value) => value !== id)
          : [...prev.additionalStaffIds, id];
        return { ...prev, additionalStaffIds: next };
      });
    } else {
      setEditingState((prev) => {
        const next = prev.additionalStaffIds.includes(id)
          ? prev.additionalStaffIds.filter((value) => value !== id)
          : [...prev.additionalStaffIds, id];
        return { ...prev, additionalStaffIds: next };
      });
    }
  };

  const addReminder = (target: 'create' | 'edit') => {
    const value = Number(reminderDraft);
    if (!Number.isFinite(value) || value < 0) {
      toast.error('Reminder must be a non-negative number of days.');
      return;
    }
    if (target === 'create') {
      setCreateState((prev) => ({
        ...prev,
        reminders: Array.from(new Set([...prev.reminders, value])).sort((a, b) => a - b),
      }));
    } else {
      setEditingState((prev) => ({
        ...prev,
        reminders: Array.from(new Set([...prev.reminders, value])).sort((a, b) => a - b),
      }));
    }
    setReminderDraft('');
  };

  const removeReminder = (target: 'create' | 'edit', value: number) => {
    if (target === 'create') {
      setCreateState((prev) => ({
        ...prev,
        reminders: prev.reminders.filter((item) => item !== value),
      }));
    } else {
      setEditingState((prev) => ({
        ...prev,
        reminders: prev.reminders.filter((item) => item !== value),
      }));
    }
  };

  const renderReminderPills = (values: number[], target: 'create' | 'edit') => (
    <div className="flex flex-wrap gap-2">
      {values.length === 0 ? (
        <span className="text-muted-foreground text-xs">No reminders added.</span>
      ) : (
        values.map((value) => (
          <Badge
            key={value}
            variant="outline"
            className="border-border/80 flex items-center gap-2 rounded-full text-[11px]"
          >
            {value}d before
            <button
              type="button"
              className="text-destructive"
              onClick={() => removeReminder(target, value)}
            >
              ×
            </button>
          </Badge>
        ))
      )}
    </div>
  );

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/80 max-h-[94vh] w-[680px] max-w-[680px] overflow-y-auto rounded-none border p-0 shadow-2xl sm:rounded-2xl">
        <DialogHeader className="border-border/80 border-b px-6 py-4">
          <DialogTitle className="text-foreground text-xl font-semibold">
            Recurring Tasks
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Select a property and unit, then manage the recurring tasks that should generate for
            that unit’s monthly logs.
          </DialogDescription>
        </DialogHeader>

        {view === 'select' ? (
          <div className="space-y-6 p-6">
            <div className="border-border/80 rounded-xl border bg-white p-4 shadow-sm">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                    Property
                  </Label>
                  <Select
                    value={selectedPropertyId}
                    onValueChange={(value) => {
                      setSelectedPropertyId(value);
                      setSelectedUnitId('');
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a property" />
                    </SelectTrigger>
                    <SelectContent>
                      {propertyOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                    Unit
                  </Label>
                  <Select
                    value={selectedUnitId}
                    disabled={!selectedPropertyId}
                    onValueChange={(value) => setSelectedUnitId(value)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose a unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitOptions.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <ShieldCheck className="h-4 w-4 text-[var(--color-success-600)]" />
                  Monthly log only
                </div>
                <Button
                  type="button"
                  className="gap-2"
                  disabled={!selectedPropertyId || !selectedUnitId}
                  onClick={goManage}
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 p-6">
            <div className="border-border/80 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
              <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="outline" className="status-pill bg-muted/60 text-foreground">
                  {selectedPropertyName}
                </Badge>
                <Badge variant="outline" className="status-pill bg-muted/60 text-foreground">
                  {selectedUnitLabel}
                </Badge>
                <span className="text-muted-foreground text-xs">Recurring tasks for this unit</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('select')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Change selection
                </Button>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="border-border/80 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="text-primary h-4 w-4" />
                    <div>
                      <div className="text-foreground text-sm font-semibold">
                        Recurring tasks ({tasks.length})
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Active tasks for this unit. Edit, pause, or remove as needed.
                      </p>
                    </div>
                  </div>
                  {isLoading ? <div className="text-muted-foreground text-xs">Loading…</div> : null}
                </div>

                {tasks.length === 0 ? (
                  <div className="border-border/70 bg-muted/40 text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                    No recurring tasks for this unit yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="border-border/80 bg-background rounded-lg border px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground text-sm font-semibold">
                              {task.title}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'status-pill text-[11px]',
                                task.isActive
                                  ? 'border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]'
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
                        <div className="text-muted-foreground mt-1 text-xs">
                          {task.frequency ? `${task.frequency} • ` : ''}
                          Due {task.dueAnchor.replace('_', ' ')}
                          {task.dueOffsetDays ? ` • Offset ${task.dueOffsetDays}d` : ''}
                        </div>
                        {task.description ? (
                          <p className="text-foreground/80 mt-2 text-sm">{task.description}</p>
                        ) : null}
                        {task.reminders.length ? (
                          <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
                            <Bell className="h-3.5 w-3.5" />
                            Reminders: {task.reminders.map((r) => `${r}d before`).join(', ')}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-border/80 space-y-3 rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Users className="text-primary h-4 w-4" />
                  <div>
                    <div className="text-foreground text-sm font-semibold">
                      {editingId ? 'Edit recurring task' : 'New recurring task'}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Assign staff, reminders, and cadence for this unit.
                    </p>
                  </div>
                </div>

                <form onSubmit={editingId ? handleEditSubmit : handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                      Subject
                    </Label>
                    <Input
                      value={editingId ? editingState.title : createState.title}
                      onChange={(event) =>
                        editingId
                          ? setEditingState((prev) => ({ ...prev, title: event.target.value }))
                          : setCreateState((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="e.g., Send owner statement draft"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                      Body
                    </Label>
                    <Textarea
                      value={editingId ? editingState.description : createState.description}
                      onChange={(event) =>
                        editingId
                          ? setEditingState((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          : setCreateState((prev) => ({ ...prev, description: event.target.value }))
                      }
                      placeholder="Optional notes or checklist items"
                      className="min-h-[100px]"
                    />
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                        Frequency
                      </Label>
                      <Select
                        value={editingId ? editingState.frequency : createState.frequency}
                        onValueChange={(value) =>
                          editingId
                            ? setEditingState((prev) => ({
                                ...prev,
                                frequency: value as RecurringTaskFormState['frequency'],
                              }))
                            : setCreateState((prev) => ({
                                ...prev,
                                frequency: value as RecurringTaskFormState['frequency'],
                              }))
                        }
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
                      <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                        Interval
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={editingId ? editingState.interval : createState.interval}
                        onChange={(event) =>
                          editingId
                            ? setEditingState((prev) => ({
                                ...prev,
                                interval: Number(event.target.value) || 1,
                              }))
                            : setCreateState((prev) => ({
                                ...prev,
                                interval: Number(event.target.value) || 1,
                              }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                        Active
                      </Label>
                      <div className="border-border/70 bg-muted/40 flex h-10 items-center gap-3 rounded-lg border px-3">
                        <Switch
                          checked={editingId ? editingState.isActive : createState.isActive}
                          onCheckedChange={(checked) =>
                            editingId
                              ? setEditingState((prev) => ({ ...prev, isActive: checked }))
                              : setCreateState((prev) => ({ ...prev, isActive: checked }))
                          }
                          id="recurring-active-toggle"
                        />
                        <Label
                          htmlFor="recurring-active-toggle"
                          className="text-foreground text-sm font-medium"
                        >
                          {editingId
                            ? editingState.isActive
                              ? 'Enabled'
                              : 'Paused'
                            : createState.isActive
                              ? 'Enabled'
                              : 'Paused'}
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                        Due anchor
                      </Label>
                      <Select
                        value={editingId ? editingState.dueAnchor : createState.dueAnchor}
                        onValueChange={(value) =>
                          editingId
                            ? setEditingState((prev) => ({
                                ...prev,
                                dueAnchor: value as RecurringTaskFormState['dueAnchor'],
                              }))
                            : setCreateState((prev) => ({
                                ...prev,
                                dueAnchor: value as RecurringTaskFormState['dueAnchor'],
                              }))
                        }
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
                      <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                        Offset (days)
                      </Label>
                      <Input
                        type="number"
                        value={editingId ? editingState.dueOffsetDays : createState.dueOffsetDays}
                        onChange={(event) =>
                          editingId
                            ? setEditingState((prev) => ({
                                ...prev,
                                dueOffsetDays: Number(event.target.value),
                              }))
                            : setCreateState((prev) => ({
                                ...prev,
                                dueOffsetDays: Number(event.target.value),
                              }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                        Reminders
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          placeholder="Days before"
                          value={reminderDraft}
                          onChange={(event) => setReminderDraft(event.target.value)}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addReminder(editingId ? 'edit' : 'create')}
                        >
                          Add
                        </Button>
                      </div>
                      {renderReminderPills(
                        editingId ? editingState.reminders : createState.reminders,
                        editingId ? 'edit' : 'create',
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                        Assigned staff
                      </Label>
                      <StaffSelect
                        value={
                          editingId ? editingState.assignedStaffId : createState.assignedStaffId
                        }
                        onChange={(id) =>
                          editingId
                            ? setEditingState((prev) => ({ ...prev, assignedStaffId: id }))
                            : setCreateState((prev) => ({ ...prev, assignedStaffId: id }))
                        }
                        placeholder={staffLoading ? 'Loading staff...' : 'Choose staff'}
                      />
                      <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Switch
                          id="auto-assign-pm"
                          checked={
                            editingId
                              ? editingState.autoAssignManager
                              : createState.autoAssignManager
                          }
                          onCheckedChange={(checked) =>
                            editingId
                              ? setEditingState((prev) => ({ ...prev, autoAssignManager: checked }))
                              : setCreateState((prev) => ({ ...prev, autoAssignManager: checked }))
                          }
                        />
                        <Label htmlFor="auto-assign-pm">Auto-assign property manager</Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                        Additional staff
                      </Label>
                      <div className="border-border/70 max-h-28 space-y-1 overflow-y-auto rounded-lg border p-2">
                        {staffOptions.length === 0 ? (
                          <div className="text-muted-foreground text-xs">No staff available.</div>
                        ) : (
                          staffOptions.map((staff) => {
                            const isChecked = editingId
                              ? editingState.additionalStaffIds.includes(staff.id)
                              : createState.additionalStaffIds.includes(staff.id);
                            return (
                              <label
                                key={staff.id}
                                className="hover:bg-muted/60 flex cursor-pointer items-center justify-between rounded-md px-2 py-1 text-sm"
                              >
                                <span>{staff.name}</span>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() =>
                                    toggleAdditionalStaff(staff.id, editingId ? 'edit' : 'create')
                                  }
                                  className="accent-primary"
                                />
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={saving}>
                      {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create recurring task'}
                    </Button>
                    {editingId ? (
                      <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
