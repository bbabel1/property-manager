import TasksPageContent from '@/components/tasks/TasksPageContent';
import { supabase, supabaseAdmin } from '@/lib/db';
import {
  normalizeTaskPriority,
  normalizeTaskStatus,
  formatTaskDate,
  formatTaskDateTime,
  formatTaskRelative,
  taskAssigneeInitials,
  type TaskPriorityKey,
  type TaskStatusKey,
} from '@/lib/tasks/utils';
import type { Database } from '@/types/database';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type PropertyRow = Database['public']['Tables']['properties']['Row'];
type UnitRow = Database['public']['Tables']['units']['Row'];

type SerializedTask = {
  id: string;
  subject: string;
  statusKey: TaskStatusKey;
  statusLabel: string;
  dueDateLabel: string;
  propertyName: string | null;
  unitLabel: string | null;
  updatedAtLabel: string;
  updatedRelativeLabel: string;
  ageLabel: string;
  priorityKey: TaskPriorityKey;
  priorityLabel: string;
  categoryLabel: string;
  assignedToLabel: string | null;
  assignedToInitials: string | null;
  vendorLabel: string | null;
};

type FilterOption = {
  id: string;
  label: string;
};

const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { id: 'all-statuses', label: 'All statuses' },
  { id: 'new', label: 'New' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'on-hold', label: 'On hold' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

function buildPropertyLabel(map: Map<string, string>, id: string | null): string | null {
  if (!id) return null;
  const label = map.get(id);
  return label ? label : null;
}

function buildUnitLabel(
  map: Map<string, Pick<UnitRow, 'unit_number' | 'unit_name'>>,
  id: string | null,
): string | null {
  if (!id) return null;
  const record = map.get(id);
  if (!record) return null;
  return record.unit_number || record.unit_name || null;
}

export default async function TasksPage() {
  const db = supabaseAdmin || supabase;

  const { data: taskRows, error: taskError } = await db
    .from('tasks')
    .select(
      'id, subject, status, scheduled_date, updated_at, created_at, priority, category, property_id, unit_id, assigned_to',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (taskError) {
    console.error('Failed to load tasks', taskError);
  }

  const tasks: TaskRow[] = taskRows ?? [];

  const propertyIds = Array.from(
    new Set(
      tasks
        .map((task) => task.property_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const unitIds = Array.from(
    new Set(
      tasks
        .map((task) => task.unit_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const propertyMap = new Map<string, string>();
  if (propertyIds.length > 0) {
    const { data: propertyRows, error: propertyError } = await db
      .from('properties')
      .select('id, name')
      .in('id', propertyIds);
    if (propertyError) {
      console.error('Failed to load properties for tasks', propertyError);
    } else {
      (propertyRows as Pick<PropertyRow, 'id' | 'name'>[] | null)?.forEach((property) => {
        propertyMap.set(property.id, property.name || 'Property');
      });
    }
  }

  const unitMap = new Map<string, Pick<UnitRow, 'unit_number' | 'unit_name'>>();
  if (unitIds.length > 0) {
    const { data: unitRows, error: unitError } = await db
      .from('units')
      .select('id, unit_number, unit_name')
      .in('id', unitIds);
    if (unitError) {
      console.error('Failed to load units for tasks', unitError);
    } else {
      (unitRows as Pick<UnitRow, 'id' | 'unit_number' | 'unit_name'>[] | null)?.forEach((unit) => {
        unitMap.set(unit.id, { unit_number: unit.unit_number, unit_name: unit.unit_name });
      });
    }
  }

  const serializedTasks: SerializedTask[] = tasks.map((task) => {
    const statusMeta = normalizeTaskStatus(task.status);
    const priorityMeta = normalizeTaskPriority(task.priority);
    const updatedIso = task.updated_at || task.created_at;
    return {
      id: task.id,
      subject: task.subject || 'Untitled task',
      statusKey: statusMeta.key,
      statusLabel: statusMeta.label,
      dueDateLabel: formatTaskDate(task.scheduled_date),
      propertyName: buildPropertyLabel(propertyMap, task.property_id),
      unitLabel: buildUnitLabel(unitMap, task.unit_id),
      updatedAtLabel: formatTaskDateTime(updatedIso),
      updatedRelativeLabel: formatTaskRelative(updatedIso),
      ageLabel: formatTaskRelative(task.created_at, false),
      priorityKey: priorityMeta.key,
      priorityLabel: priorityMeta.label,
      categoryLabel: task.category || '—',
      assignedToLabel: task.assigned_to || null,
      assignedToInitials: taskAssigneeInitials(task.assigned_to),
      vendorLabel: '—',
    };
  });

  const propertyFilterOptions: FilterOption[] = [
    { id: 'all-properties', label: 'All properties' },
    ...Array.from(propertyMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, label]) => ({ id, label })),
  ];

  return (
    <TasksPageContent
      tasks={serializedTasks}
      propertyFilterOptions={propertyFilterOptions}
      statusFilterOptions={STATUS_FILTER_OPTIONS}
    />
  );
}

export type { SerializedTask, FilterOption };
