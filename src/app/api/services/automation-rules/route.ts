import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (
      !hasPermission(auth.roles, 'settings.read') &&
      !hasPermission(auth.roles, 'settings.write')
    ) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { supabase } = auth;

    const { data: rules, error } = await supabase
      .from('service_automation_rules')
      .select(
        `
        id,
        offering_id,
        rule_type,
        frequency,
        task_template,
        charge_template,
        conditions,
        is_active,
        service_offerings!inner(id, name)
      `,
      )
      .order('service_offerings(name)')
      .order('rule_type');

    if (error) {
      logger.error({ error }, 'Error fetching automation rules');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load automation rules' } },
        { status: 500 },
      );
    }

    // Transform to flatten service_offerings
    const transformed = (rules || []).map((r: any) => ({
      id: r.id,
      offering_id: r.offering_id,
      offering_name: r.service_offerings?.name || 'Unknown',
      rule_type: r.rule_type,
      frequency: r.frequency,
      task_template: r.task_template,
      charge_template: r.charge_template,
      conditions: r.conditions,
      is_active: r.is_active,
    }));

    return NextResponse.json({ data: transformed });
  } catch (error) {
    logger.error({ error }, 'Error in GET /api/services/automation-rules');
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!hasPermission(auth.roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { supabase } = auth;
    const body = await request.json();
    const { offering_id, rule_type, frequency, task_template, charge_template, is_active } = body;

    if (!offering_id || !rule_type || !frequency) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Missing required fields' } },
        { status: 400 },
      );
    }

    if (rule_type === 'recurring_task' && !task_template) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'task_template is required for recurring_task' } },
        { status: 400 },
      );
    }

    if (rule_type === 'recurring_charge' && !charge_template) {
      return NextResponse.json(
        {
          error: { code: 'BAD_REQUEST', message: 'charge_template is required for recurring_charge' },
        },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('service_automation_rules')
      .insert({
        offering_id,
        rule_type,
        frequency,
        task_template: task_template || null,
        charge_template: charge_template || null,
        is_active: is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Error creating automation rule');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to create automation rule' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error({ error }, 'Error in POST /api/services/automation-rules');
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
