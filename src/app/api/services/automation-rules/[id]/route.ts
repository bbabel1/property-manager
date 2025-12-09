import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!hasPermission(auth.roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const { supabase } = auth;
    const body = await request.json();
    const { offering_id, rule_type, frequency, task_template, charge_template, is_active } = body;

    const updateData: any = {};
    if (offering_id !== undefined) updateData.offering_id = offering_id;
    if (rule_type !== undefined) updateData.rule_type = rule_type;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (task_template !== undefined) updateData.task_template = task_template || null;
    if (charge_template !== undefined) updateData.charge_template = charge_template || null;
    if (is_active !== undefined) updateData.is_active = is_active;

    if (updateData.rule_type === 'recurring_task' && !updateData.task_template) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'task_template is required for recurring_task' } },
        { status: 400 },
      );
    }

    if (updateData.rule_type === 'recurring_charge' && !updateData.charge_template) {
      return NextResponse.json(
        {
          error: { code: 'BAD_REQUEST', message: 'charge_template is required for recurring_charge' },
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('service_automation_rules')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Error updating automation rule');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to update automation rule' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error({ error }, 'Error in PUT /api/services/automation-rules/[id]');
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth();
    if (!hasPermission(auth.roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const { supabase } = auth;

    const { error } = await supabase.from('service_automation_rules').delete().eq('id', id);

    if (error) {
      logger.error({ error }, 'Error deleting automation rule');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to delete automation rule' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error in DELETE /api/services/automation-rules/[id]');
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
