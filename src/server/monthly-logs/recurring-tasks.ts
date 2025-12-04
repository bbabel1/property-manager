import type { RecurringTaskTemplate } from '@/components/monthly-logs/types';
import type { TypedSupabaseClient } from '@/lib/db';
import type { Database } from '@/types/database';

type RuleRow = Database['public']['Tables']['monthly_log_task_rules']['Row'];
type UnitRow = Database['public']['Tables']['units']['Row'];

type RecurringTaskPayload = {
  propertyId: string;
  unitId: string;
  title: string;
  description?: string | null;
  dueAnchor?: 'period_start' | 'period_end';
  dueOffsetDays?: number;
  frequency?: string;
  interval?: number;
  isActive?: boolean;
  assignedStaffId?: number | null;
  additionalStaffIds?: number[];
  autoAssignManager?: boolean;
  reminders?: number[];
};

type RecurringTaskUpdates = Partial<Omit<RecurringTaskPayload, 'propertyId' | 'unitId'>>;

const extractIdFromConditions = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id === 'string') return record.id;
  if (typeof record.unit_id === 'string') return record.unit_id;
  if (typeof record.property_id === 'string') return record.property_id;
  return null;
};

const mapRuleToRecurringTask = (
  row: RuleRow,
  fallback: { propertyId: string; unitId: string },
): RecurringTaskTemplate => {
  const propertyId = extractIdFromConditions(row.property_conditions) ?? fallback.propertyId;
  const unitConditions = (row.unit_conditions as Record<string, unknown> | null) ?? {};
  const unitId = extractIdFromConditions(unitConditions) ?? fallback.unitId;
  const reminders = Array.isArray(unitConditions.reminders)
    ? unitConditions.reminders
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    : [];
  const additionalStaff = Array.isArray(unitConditions.additional_staff)
    ? unitConditions.additional_staff
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    : [];
  const autoAssignManager =
    unitConditions.auto_assign_manager === false ? false : true;

  return {
    id: row.id,
    title: row.name || row.subject_template || 'Recurring task',
    description: row.description_template ?? null,
    dueAnchor: (row.due_anchor as 'period_start' | 'period_end' | null) ?? 'period_end',
    dueOffsetDays:
      typeof row.due_offset_days === 'number' && Number.isFinite(row.due_offset_days)
        ? row.due_offset_days
        : 0,
    frequency: row.frequency || 'monthly',
    interval: typeof row.interval === 'number' && row.interval > 0 ? row.interval : 1,
    isActive: row.is_active !== false,
    propertyId,
    unitId,
    updatedAt: row.updated_at ?? row.created_at ?? null,
    assignedStaffId:
      typeof row.assigned_to_staff_id === 'number' ? row.assigned_to_staff_id : null,
    additionalStaffIds: additionalStaff,
    autoAssignManager,
    reminders,
  };
};

const loadUnitContext = async (
  supabase: TypedSupabaseClient,
  propertyId: string,
  unitId: string,
  allowedOrgIds: string[],
): Promise<{ unit: UnitRow; orgId: string }> => {
  const { data, error } = await supabase
    .from('units')
    .select('id, property_id, org_id, unit_number, unit_name')
    .eq('id', unitId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Unit not found');
  }

  if (data.property_id !== propertyId) {
    throw new Error('Unit does not belong to the selected property');
  }

  const orgId = data.org_id;
  if (!orgId || (allowedOrgIds.length > 0 && !allowedOrgIds.includes(orgId))) {
    throw new Error('Access denied for this organization');
  }

  return { unit: data as UnitRow, orgId };
};

export async function listRecurringTasksForUnit(
  supabase: TypedSupabaseClient,
  params: { propertyId: string; unitId: string; orgIds: string[] },
): Promise<RecurringTaskTemplate[]> {
  const { propertyId, unitId, orgIds } = params;
  if (!propertyId || !unitId) return [];
  const { orgId } = await loadUnitContext(supabase, propertyId, unitId, orgIds);

  const { data, error } = await supabase
    .from('monthly_log_task_rules')
    .select(
      'id, name, subject_template, description_template, due_anchor, due_offset_days, frequency, interval, is_active, property_conditions, unit_conditions, updated_at, created_at, assigned_to_staff_id',
    )
    .eq('org_id', orgId)
    .contains('unit_conditions', { id: unitId })
    .order('updated_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) =>
    mapRuleToRecurringTask(row as RuleRow, { propertyId, unitId }),
  );
}

export async function createRecurringTaskForUnit(
  supabase: TypedSupabaseClient,
  payload: RecurringTaskPayload,
  orgIds: string[],
): Promise<RecurringTaskTemplate> {
  const { title, description, propertyId, unitId } = payload;
  if (!title?.trim()) throw new Error('Title is required');
  if (!propertyId || !unitId) throw new Error('Property and unit are required');

  const { orgId } = await loadUnitContext(supabase, propertyId, unitId, orgIds);

  const dueAnchor = payload.dueAnchor === 'period_start' ? 'period_start' : 'period_end';
  const dueOffset =
    typeof payload.dueOffsetDays === 'number' && Number.isFinite(payload.dueOffsetDays)
      ? payload.dueOffsetDays
      : 0;
  const frequency = payload.frequency?.trim() || 'monthly';
  const interval = typeof payload.interval === 'number' && payload.interval > 0 ? payload.interval : 1;
  const additionalStaffIds =
    Array.isArray(payload.additionalStaffIds) && payload.additionalStaffIds.length
      ? payload.additionalStaffIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id))
      : [];
  const reminders =
    Array.isArray(payload.reminders) && payload.reminders.length
      ? payload.reminders.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];
  const autoAssignManager = payload.autoAssignManager === false ? false : true;
  const assignedStaffId =
    typeof payload.assignedStaffId === 'number' && Number.isFinite(payload.assignedStaffId)
      ? payload.assignedStaffId
      : null;

  const unitConditions = {
    id: unitId,
    additional_staff: additionalStaffIds,
    reminders,
    auto_assign_manager: autoAssignManager,
  };

  const { data, error } = await supabase
    .from('monthly_log_task_rules')
    .insert({
      org_id: orgId,
      name: title.trim(),
      subject_template: title.trim(),
      description_template: description?.trim() || null,
      due_anchor: dueAnchor,
      due_offset_days: dueOffset,
      frequency,
      interval,
      is_active: payload.isActive === false ? false : true,
      property_conditions: { id: propertyId },
      unit_conditions: unitConditions,
      stage_trigger: null,
      category_id: null,
      assigned_to_staff_id: assignedStaffId,
    })
    .select(
      'id, name, subject_template, description_template, due_anchor, due_offset_days, frequency, interval, is_active, property_conditions, unit_conditions, updated_at, created_at, assigned_to_staff_id',
    )
    .single();

  if (error || !data) {
    throw error;
  }

  return mapRuleToRecurringTask(data as RuleRow, { propertyId, unitId });
}

export async function updateRecurringTaskForUnit(
  supabase: TypedSupabaseClient,
  id: string,
  updates: RecurringTaskUpdates,
  orgIds: string[],
): Promise<RecurringTaskTemplate> {
  if (!id) throw new Error('Recurring task id is required');

  const { data: existing, error: existingError } = await supabase
    .from('monthly_log_task_rules')
    .select(
      'id, org_id, property_conditions, unit_conditions, name, subject_template, description_template, due_anchor, due_offset_days, frequency, interval, is_active, updated_at, created_at, assigned_to_staff_id',
    )
    .eq('id', id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw new Error('Recurring task not found');

  const propertyId = extractIdFromConditions(existing.property_conditions);
  const unitConditions = (existing.unit_conditions as Record<string, unknown> | null) ?? {};
  const unitId = extractIdFromConditions(unitConditions);
  if (!propertyId || !unitId) {
    throw new Error('Recurring task is missing property or unit targeting');
  }
  if (existing.org_id && orgIds.length > 0 && !orgIds.includes(existing.org_id)) {
    throw new Error('Access denied for this organization');
  }

  const nextUnitConditions: Record<string, unknown> = {
    ...unitConditions,
    id: unitId,
  };

  if (Array.isArray(updates.additionalStaffIds)) {
    nextUnitConditions.additional_staff = updates.additionalStaffIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
  }
  if (Array.isArray(updates.reminders)) {
    nextUnitConditions.reminders = updates.reminders
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));
  }
  if (updates.autoAssignManager === true || updates.autoAssignManager === false) {
    nextUnitConditions.auto_assign_manager = updates.autoAssignManager;
  }

  const nextUpdates: Record<string, unknown> = {
    unit_conditions: nextUnitConditions,
    updated_at: new Date().toISOString(),
  };

  if (typeof updates.title === 'string') {
    const trimmed = updates.title.trim();
    if (trimmed) {
      nextUpdates.name = trimmed;
      nextUpdates.subject_template = trimmed;
    }
  }
  if (updates.description !== undefined) {
    nextUpdates.description_template = updates.description ? updates.description.trim() : null;
  }
  if (updates.dueAnchor) {
    nextUpdates.due_anchor = updates.dueAnchor === 'period_start' ? 'period_start' : 'period_end';
  }
  if (typeof updates.dueOffsetDays === 'number') {
    nextUpdates.due_offset_days = Number.isFinite(updates.dueOffsetDays) ? updates.dueOffsetDays : 0;
  }
  if (updates.frequency) {
    nextUpdates.frequency = updates.frequency.trim();
  }
  if (typeof updates.interval === 'number' && updates.interval > 0) {
    nextUpdates.interval = updates.interval;
  }
  if (updates.isActive === true || updates.isActive === false) {
    nextUpdates.is_active = updates.isActive;
  }
  if (updates.assignedStaffId !== undefined) {
    nextUpdates.assigned_to_staff_id =
      typeof updates.assignedStaffId === 'number' && Number.isFinite(updates.assignedStaffId)
        ? updates.assignedStaffId
        : null;
  }

  const { error } = await supabase.from('monthly_log_task_rules').update(nextUpdates).eq('id', id);
  if (error) throw error;

  const { data: refreshed, error: refreshError } = await supabase
    .from('monthly_log_task_rules')
    .select(
      'id, name, subject_template, description_template, due_anchor, due_offset_days, frequency, interval, is_active, property_conditions, unit_conditions, updated_at, created_at, assigned_to_staff_id',
    )
    .eq('id', id)
    .maybeSingle();

  if (refreshError) throw refreshError;
  if (!refreshed) throw new Error('Recurring task not found after update');

  return mapRuleToRecurringTask(refreshed as RuleRow, { propertyId, unitId });
}

export async function deleteRecurringTaskForUnit(
  supabase: TypedSupabaseClient,
  id: string,
  orgIds: string[],
): Promise<void> {
  if (!id) throw new Error('Recurring task id is required');

  const { data: existing, error: existingError } = await supabase
    .from('monthly_log_task_rules')
    .select('id, org_id')
    .eq('id', id)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) throw new Error('Recurring task not found');
  if (existing.org_id && orgIds.length > 0 && !orgIds.includes(existing.org_id)) {
    throw new Error('Access denied for this organization');
  }

  const { error } = await supabase.from('monthly_log_task_rules').delete().eq('id', id);
  if (error) throw error;
}
