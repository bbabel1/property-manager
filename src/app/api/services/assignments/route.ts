import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { supabase, user, roles } = auth;

    const canRead =
      hasPermission(roles, 'settings.read') ||
      hasPermission(roles, 'settings.write') ||
      hasPermission(roles, 'properties.read');

    if (!canRead) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId') || null;
    const unitId = searchParams.get('unitId') || null;
    const scopeValueForQuery = propertyId ?? unitId;

    if (!scopeValueForQuery) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'propertyId or unitId is required' } },
        { status: 400 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    const scopeColumn: 'property_id' | 'unit_id' = propertyId ? 'property_id' : 'unit_id';

    const db = supabaseAdmin ?? supabase;

    const { data: assignment, error: assignmentError } = await db
      .from('service_plan_assignments')
      .select(
        'id, plan_id, property_id, unit_id, plan_fee_amount, plan_fee_percent, plan_fee_frequency, service_plans(name)',
      )
      .eq('org_id', orgId)
      .eq(scopeColumn, scopeValueForQuery)
      .is('effective_end', null)
      .order('effective_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (assignmentError) {
      logger.error(
        { error: assignmentError, userId: user.id, orgId, scopeColumn, scopeValue: scopeValueForQuery },
        'Error fetching service plan assignment',
      );
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load service assignment' } },
        { status: 500 },
      );
    }

    if (!assignment) {
      return NextResponse.json({ data: [] });
    }

    const relatedPlan = (assignment as { service_plans?: { name?: string | null } | null })
      ?.service_plans;
    const planName = relatedPlan?.name ?? null;

    const summaryRow = {
      assignment_id: assignment.id,
      id: assignment.id,
      plan_id: assignment.plan_id,
      plan_name: planName,
      property_id: assignment.property_id,
      unit_id: assignment.unit_id,
      plan_fee_amount: assignment.plan_fee_amount,
      plan_fee_percent: assignment.plan_fee_percent,
      plan_fee_frequency: assignment.plan_fee_frequency,
    };

    return NextResponse.json({ data: [summaryRow] });
  } catch (error) {
    logger.error({ error }, 'Error in GET /api/services/assignments');
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
    const { user, roles } = auth;

    if (!hasPermission(roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);
    const body = await request.json().catch(() => ({}));
    const { property_id, plan_id, plan_name, unit_id } = body;

    if (!property_id || (!plan_id && !plan_name)) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'property_id and plan_id (or plan_name) are required',
          },
        },
        { status: 400 },
      );
    }

    const desiredAssignment: 'Property Level' | 'Unit Level' = unit_id
      ? 'Unit Level'
      : 'Property Level';

    const { data: propertyRow, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('service_assignment')
      .eq('id', property_id)
      .maybeSingle();

    if (propertyError) {
      logger.error({ error: propertyError, userId: user.id, property_id }, 'Error loading property');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load property' } },
        { status: 500 },
      );
    }

    if (!propertyRow) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    const currentAssignment = (propertyRow.service_assignment ??
      null) as 'Property Level' | 'Unit Level' | null;

    if (currentAssignment && currentAssignment !== desiredAssignment) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_SCOPE',
            message:
              desiredAssignment === 'Property Level'
                ? 'Property is set to Unit Level assignments. Assign the plan on the unit page.'
                : 'Property is set to Property Level assignments. Remove property-level assignment before adding unit-level.',
          },
        },
        { status: 400 },
      );
    }

    if (!currentAssignment) {
      const { error: updateError } = await supabaseAdmin
        .from('properties')
        .update({ service_assignment: desiredAssignment })
        .eq('id', property_id);
      if (updateError) {
        logger.error(
          { error: updateError, userId: user.id, property_id, desiredAssignment },
          'Failed to set service_assignment on property',
        );
        return NextResponse.json(
          {
            error: {
              code: 'ASSIGNMENT_MODE_ERROR',
              message: 'Failed to set property assignment mode',
            },
          },
          { status: 500 },
        );
      }
    }

    // Resolve or create plan_id if only plan_name was provided
    let resolvedPlanId = plan_id as string | null;
    const createdPlanIds: string[] = [];
    if (!resolvedPlanId && plan_name) {
      const planNameTrimmed = String(plan_name).trim();
      const { data: existingPlan, error: planLookupError } = await supabaseAdmin
        .from('service_plans')
        .select('id')
        .eq('org_id', orgId)
        .ilike('name', planNameTrimmed)
        .maybeSingle();

      if (planLookupError) {
        logger.error(
          { error: planLookupError, userId: user.id, orgId, planName: planNameTrimmed },
          'Error looking up service plan by name',
        );
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to resolve plan' } },
          { status: 500 },
        );
      }

      if (existingPlan?.id) {
        resolvedPlanId = existingPlan.id;
      } else {
        const { data: newPlan, error: insertPlanError } = await supabaseAdmin
          .from('service_plans')
          .insert({
            org_id: orgId,
            name: planNameTrimmed,
            amount_type: 'flat',
            percent_basis: 'lease_rent_amount',
            is_active: true,
          })
          .select('id')
          .single();

        if (insertPlanError || !newPlan?.id) {
          logger.error(
            { error: insertPlanError, userId: user.id, orgId, planName: planNameTrimmed },
            'Error creating service plan',
          );
          return NextResponse.json(
            { error: { code: 'QUERY_ERROR', message: 'Failed to create service plan' } },
            { status: 500 },
          );
        }

        resolvedPlanId = newPlan.id;
        createdPlanIds.push(newPlan.id);
      }
    }

    if (!resolvedPlanId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'plan_id could not be determined' } },
        { status: 400 },
      );
    }

    const planFeeAmount = body.plan_fee_amount ?? null;
    const planFeePercent = body.plan_fee_percent ?? 0;
    const planFeeFrequency = body.plan_fee_frequency || 'Monthly';

    const { data, error } = await supabaseAdmin
      .from('service_plan_assignments')
      .insert({
        org_id: orgId,
        property_id,
        unit_id: unit_id ?? null,
        plan_id: resolvedPlanId,
        plan_fee_amount: planFeeAmount,
        plan_fee_percent: planFeePercent,
        plan_fee_frequency: planFeeFrequency,
      })
      .select('id, plan_id')
      .single();

    if (error) {
      logger.error({ error, userId: user.id }, 'Error creating service plan assignment');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to save service assignment' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error({ error }, 'Error in POST /api/services/assignments');
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        );
      }
      if (error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json(
          { error: { code: 'ORG_CONTEXT_REQUIRED', message: 'Organization context required' } },
          { status: 400 },
        );
      }
      if (error.message === 'ORG_FORBIDDEN') {
        return NextResponse.json(
          { error: { code: 'ORG_FORBIDDEN', message: 'Forbidden: organization access denied' } },
          { status: 403 },
        );
      }
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { user, roles } = auth;

    if (!hasPermission(roles, 'settings.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);
    const body = await request.json().catch(() => ({}));
    const { assignment_id, plan_id, plan_name } = body;

    if (!assignment_id || (!plan_id && !plan_name)) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'assignment_id and plan_id (or plan_name) are required',
          },
        },
        { status: 400 },
      );
    }

    const { data: assignmentRow, error: assignmentError } = await supabaseAdmin
      .from('service_plan_assignments')
      .select('id, property_id, unit_id')
      .eq('id', assignment_id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (assignmentError) {
      logger.error({ error: assignmentError, userId: user.id, assignment_id }, 'Error loading assignment');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load assignment' } },
        { status: 500 },
      );
    }

    if (!assignmentRow) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Assignment not found' } },
        { status: 404 },
      );
    }

    const { property_id: propertyIdFromAssignment, unit_id: unitIdFromAssignment } = assignmentRow;
    const desiredAssignment: 'Property Level' | 'Unit Level' = unitIdFromAssignment
      ? 'Unit Level'
      : 'Property Level';

    if (!propertyIdFromAssignment) {
      return NextResponse.json(
        { error: { code: 'INVALID_DATA', message: 'Assignment is missing property context' } },
        { status: 400 },
      );
    }

    const { data: propertyRow, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('service_assignment')
      .eq('id', propertyIdFromAssignment)
      .maybeSingle();

    if (propertyError) {
      logger.error({ error: propertyError, userId: user.id, property_id: propertyIdFromAssignment }, 'Error loading property');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to load property' } },
        { status: 500 },
      );
    }

    const currentAssignment = (propertyRow?.service_assignment ??
      null) as 'Property Level' | 'Unit Level' | null;
    if (!propertyRow) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    if (currentAssignment && currentAssignment !== desiredAssignment) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_SCOPE',
            message:
              desiredAssignment === 'Property Level'
                ? 'Property is set to Unit Level assignments. Assign the plan on the unit page.'
                : 'Property is set to Property Level assignments. Remove property-level assignment before adding unit-level.',
          },
        },
        { status: 400 },
      );
    }

    if (!currentAssignment) {
      const { error: updateError } = await supabaseAdmin
        .from('properties')
        .update({ service_assignment: desiredAssignment })
        .eq('id', propertyIdFromAssignment);
      if (updateError) {
        logger.error(
          { error: updateError, userId: user.id, property_id: propertyIdFromAssignment, desiredAssignment },
          'Failed to set service_assignment on property (PATCH)',
        );
        return NextResponse.json(
          {
            error: {
              code: 'ASSIGNMENT_MODE_ERROR',
              message: 'Failed to set property assignment mode',
            },
          },
          { status: 500 },
        );
      }
    }

    let resolvedPlanId = plan_id as string | null;
    if (!resolvedPlanId && plan_name) {
      const planNameTrimmed = String(plan_name).trim();
      const { data: existingPlan, error: planLookupError } = await supabaseAdmin
        .from('service_plans')
        .select('id')
        .eq('org_id', orgId)
        .ilike('name', planNameTrimmed)
        .maybeSingle();

      if (planLookupError) {
        logger.error(
          { error: planLookupError, userId: user.id, orgId, planName: planNameTrimmed },
          'Error looking up service plan by name (PATCH)',
        );
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to resolve plan' } },
          { status: 500 },
        );
      }

      if (existingPlan?.id) {
        resolvedPlanId = existingPlan.id;
      }
    }

    if (!resolvedPlanId) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'plan_id could not be determined' } },
        { status: 400 },
      );
    }

    const planFeeAmount = body.plan_fee_amount ?? null;
    const planFeePercent = body.plan_fee_percent ?? 0;
    const planFeeFrequency = body.plan_fee_frequency || 'Monthly';

    const { data, error } = await supabaseAdmin
      .from('service_plan_assignments')
      .update({
        plan_id: resolvedPlanId,
        plan_fee_amount: planFeeAmount,
        plan_fee_percent: planFeePercent,
        plan_fee_frequency: planFeeFrequency,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignment_id)
      .select('id, plan_id')
      .single();

    if (error) {
      logger.error({ error, userId: user.id }, 'Error updating service plan assignment');
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to update service assignment' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    logger.error({ error }, 'Error in PATCH /api/services/assignments');
    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
          { status: 401 },
        );
      }
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
