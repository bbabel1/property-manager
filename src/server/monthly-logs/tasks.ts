import {
  formatTaskDate,
  formatTaskRelative,
  normalizeTaskPriority,
  normalizeTaskStatus,
  taskAssigneeInitials,
  type TaskPriorityKey,
  type TaskStatusKey,
} from '@/lib/tasks/utils';
import type { TypedSupabaseClient } from '@/lib/db';
import type { MonthlyLogTaskSummary } from '@/components/monthly-logs/types';
import type { Database } from '@/types/database';
import type { PostgrestError } from '@supabase/supabase-js';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskSelection = Pick<
  TaskRow,
  | 'id'
  | 'subject'
  | 'status'
  | 'priority'
  | 'scheduled_date'
  | 'updated_at'
  | 'created_at'
  | 'category'
  | 'assigned_to'
>;
type CreateMonthlyLogTaskInput = {
  subject: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: TaskPriorityKey | null;
  status?: TaskStatusKey | null;
  category?: string | null;
  assignedTo?: string | null;
  taskCategoryId?: string | null;
};

function toMonthlyLogTaskSummary(row: TaskSelection): MonthlyLogTaskSummary {
  const statusMeta = normalizeTaskStatus(row.status);
  const priorityMeta = normalizeTaskPriority(row.priority);
  const updatedIso = row.updated_at || row.created_at;
  return {
    id: row.id,
    subject: row.subject || 'Untitled task',
    statusKey: statusMeta.key,
    statusLabel: statusMeta.label,
    dueDateLabel: formatTaskDate(row.scheduled_date),
    priorityKey: priorityMeta.key,
    priorityLabel: priorityMeta.label,
    categoryLabel: row.category || null,
    assignedToLabel: row.assigned_to || null,
    assignedToInitials: taskAssigneeInitials(row.assigned_to),
    updatedRelativeLabel: formatTaskRelative(updatedIso),
  };
}

export async function listMonthlyLogTasks(
  monthlyLogId: string,
  supabase: TypedSupabaseClient,
): Promise<MonthlyLogTaskSummary[]> {
  const { data, error }: { data: TaskSelection[] | null; error: PostgrestError | null } = await supabase
    .from('tasks')
    .select(
      'id, subject, status, priority, scheduled_date, updated_at, created_at, category, assigned_to',
    )
    .eq('monthly_log_id', monthlyLogId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toMonthlyLogTaskSummary(row));
}

export async function createMonthlyLogTask(
  monthlyLogId: string,
  input: CreateMonthlyLogTaskInput,
  supabase: TypedSupabaseClient,
): Promise<MonthlyLogTaskSummary> {
  const subject = input.subject?.trim();
  if (!subject) {
    throw new Error('Subject is required');
  }

  const { data: monthlyLog, error: logError } = await supabase
    .from('monthly_logs')
    .select('id, property_id, unit_id')
    .eq('id', monthlyLogId)
    .maybeSingle();

  if (logError) {
    throw logError;
  }

  if (!monthlyLog) {
    throw new Error('Monthly log not found');
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      subject,
      description: input.description || null,
      scheduled_date: input.dueDate || null,
      priority: input.priority || 'normal',
      status: input.status || 'new',
      category: input.category || null,
      task_category_id: input.taskCategoryId || null,
      assigned_to: input.assignedTo || null,
      property_id: monthlyLog.property_id || null,
      unit_id: monthlyLog.unit_id || null,
      monthly_log_id: monthlyLogId,
      source: 'monthly_log',
    })
    .select('id, subject, status, priority, scheduled_date, updated_at, created_at, category, assigned_to')
    .single();

  const typedData = data as TaskSelection | null;

  if (error || !typedData) {
    throw error;
  }

  return toMonthlyLogTaskSummary(typedData);
}

export type { CreateMonthlyLogTaskInput };
