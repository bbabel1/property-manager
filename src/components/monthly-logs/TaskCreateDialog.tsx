'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { TaskPriorityKey, TaskStatusKey } from '@/lib/tasks/utils';
import type { MonthlyLogTaskSummary } from './types';

interface TaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthlyLogId: string;
  initialDueDate: string;
  onTaskCreated: (task: MonthlyLogTaskSummary) => void;
}

export default function TaskCreateDialog({
  open,
  onOpenChange,
  monthlyLogId,
  initialDueDate,
  onTaskCreated,
}: TaskCreateDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState({
    subject: '',
    description: '',
    dueDate: initialDueDate,
    priority: 'normal' as TaskPriorityKey,
    status: 'new' as TaskStatusKey,
    category: '',
    assignedTo: '',
  });

  const updateField = <K extends keyof typeof formState>(key: K, value: (typeof formState)[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!formState.subject.trim()) {
        toast.error('Subject is required.');
        return;
      }
      setSaving(true);
      try {
        let dueDateIso: string | null = null;
        if (formState.dueDate && formState.dueDate.trim()) {
          const parsedDate = new Date(formState.dueDate);
          dueDateIso = Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
        }

        const response = await fetch(`/api/monthly-logs/${monthlyLogId}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject: formState.subject,
            description: formState.description || null,
            dueDate: dueDateIso,
            priority: formState.priority,
            status: formState.status,
            category: formState.category || null,
            assignedTo: formState.assignedTo || null,
          }),
        });

        const bodyText = await response.text();
        let parsed: any = {};
        try {
          parsed = bodyText ? JSON.parse(bodyText) : {};
        } catch {
          parsed = {};
        }
        if (!response.ok) {
          throw new Error(parsed?.error || 'Failed to create task');
        }

        const created = parsed as MonthlyLogTaskSummary;
        onTaskCreated(created);
        toast.success('Task created');
        setFormState({
          subject: '',
          description: '',
          dueDate: initialDueDate,
          priority: 'normal',
          status: 'new',
          category: '',
          assignedTo: '',
        });
        onOpenChange(false);
      } catch (error) {
        console.error('Failed to create monthly log task', error);
        toast.error((error as Error)?.message || 'Could not create task');
      } finally {
        setSaving(false);
      }
    },
    [formState, initialDueDate, monthlyLogId, onTaskCreated, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Add a new task linked to this monthly log.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formState.subject}
                onChange={(event) => updateField('subject', event.target.value)}
                placeholder="Summarize the task"
                disabled={saving}
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Due date
              </Label>
              <Input
                type="date"
                value={formState.dueDate}
                onChange={(event) => updateField('dueDate', event.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Priority
              </Label>
              <Select
                value={formState.priority}
                onValueChange={(value) => updateField('priority', value as TaskPriorityKey)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Status
              </Label>
              <Select
                value={formState.status}
                onValueChange={(value) => updateField('status', value as TaskStatusKey)}
                disabled={saving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In progress</SelectItem>
                  <SelectItem value="on_hold">On hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
                Category
              </Label>
              <Input
                value={formState.category}
                onChange={(event) => updateField('category', event.target.value)}
                placeholder="Optional category"
                disabled={saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
              Assigned to
            </Label>
            <Input
              value={formState.assignedTo}
              onChange={(event) => updateField('assignedTo', event.target.value)}
              placeholder="Name or email"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold tracking-wide text-slate-600 uppercase">
              Description
            </Label>
            <Textarea
              value={formState.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="Add context or instructions..."
              className="min-h-[100px]"
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Create task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
