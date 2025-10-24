import { format, formatDistanceToNow } from 'date-fns';

import type { Database } from '@/types/database';

export type TaskStatusKey = 'new' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
export type TaskPriorityKey = 'low' | 'normal' | 'high' | 'urgent';
export type TaskKindKey = Database['public']['Enums']['task_kind_enum'];

export const TASK_KIND_LABELS: Record<TaskKindKey, string> = {
  owner: 'Rental owner request',
  resident: 'Resident request',
  contact: 'Contact request',
  todo: 'To do',
  other: 'Task',
};

export function normalizeTaskStatus(
  raw: string | null | undefined,
): {
  key: TaskStatusKey;
  label: string;
} {
  const value = String(raw ?? '').trim().toLowerCase();
  switch (value) {
    case 'completed':
    case 'complete':
      return { key: 'completed', label: 'Completed' };
    case 'cancelled':
    case 'canceled':
      return { key: 'cancelled', label: 'Cancelled' };
    case 'on_hold':
    case 'onhold':
    case 'on hold':
      return { key: 'on_hold', label: 'On hold' };
    case 'inprogress':
    case 'in-progress':
    case 'in_progress':
    case 'in progress':
      return { key: 'in_progress', label: 'In progress' };
    case 'new':
    case 'open':
    case 'pending':
    default:
      return { key: 'new', label: 'New' };
  }
}

export function normalizeTaskPriority(
  raw: string | null | undefined,
): {
  key: TaskPriorityKey;
  label: string;
} {
  const value = String(raw ?? '').trim().toLowerCase();
  switch (value) {
    case 'low':
      return { key: 'low', label: 'Low' };
    case 'high':
      return { key: 'high', label: 'High' };
    case 'urgent':
      return { key: 'urgent', label: 'Urgent' };
    default:
      return { key: 'normal', label: 'Normal' };
  }
}

export function formatTaskDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'M/d/yyyy');
}

export function formatTaskDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'M/d/yyyy h:mm a');
}

export function formatTaskRelative(iso: string | null | undefined, addSuffix = true): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return formatDistanceToNow(date, { addSuffix });
}

export function taskAssigneeInitials(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed.includes('@')) {
    const [firstPart] = trimmed.split('@');
    const cleaned = firstPart?.trim();
    if (!cleaned) return null;
    if (cleaned.length === 1) return cleaned.toUpperCase();
    return `${cleaned[0]}${cleaned.slice(-1)}`.toUpperCase();
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    const word = parts[0];
    if (word.length === 1) return word.toUpperCase();
    return `${word[0]}${word[word.length - 1]}`.toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function taskKindLabel(kind: string | null | undefined): string {
  if (!kind) return 'Task';
  const normalized = String(kind).toLowerCase() as TaskKindKey;
  return TASK_KIND_LABELS[normalized] ?? 'Task';
}
