import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';

type AssignmentLevel = 'Property Level' | 'Unit Level';

function normalizeAssignmentLevel(value: unknown): AssignmentLevel | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim();
  if (cleaned === 'Property Level' || cleaned === 'Unit Level') return cleaned;
  return null;
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

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: { code: 'SERVER_MISCONFIGURED', message: 'Service role client is unavailable' } },
        { status: 500 },
      );
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);
    const body = await request.json().catch(() => ({}));
    const propertyId = (body?.property_id ?? body?.propertyId) as string | undefined;
    const desired = normalizeAssignmentLevel(body?.service_assignment ?? body?.serviceAssignment);

    if (!propertyId || !desired) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'property_id and service_assignment (Property Level or Unit Level) are required',
          },
        },
        { status: 400 },
      );
    }

    const { data: propertyRow, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id, org_id, service_assignment')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (propertyError) {
      logger.error({ error: propertyError, userId: user.id, orgId, propertyId }, 'Failed to load property');
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

    const current = (propertyRow.service_assignment ?? null) as AssignmentLevel | null;

    if (current !== desired) {
      // Clear active plan assignments and selected services so the property can be reconfigured
      // from scratch under the new assignment level.
      const { error: deleteError } = await supabaseAdmin
        .from('service_plan_assignments')
        .delete()
        .eq('org_id', orgId)
        .eq('property_id', propertyId)
        .is('effective_end', null);

      if (deleteError) {
        logger.error(
          { error: deleteError, userId: user.id, orgId, propertyId },
          'Failed to clear service plan assignments when changing assignment level',
        );
        return NextResponse.json(
          { error: { code: 'QUERY_ERROR', message: 'Failed to clear existing service assignments' } },
          { status: 500 },
        );
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('properties')
      .update({ service_assignment: desired })
      .eq('id', propertyId)
      .eq('org_id', orgId);

    if (updateError) {
      logger.error(
        { error: updateError, userId: user.id, orgId, propertyId, desired },
        'Failed to update property service_assignment',
      );
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to update assignment level' } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: {
        property_id: propertyId,
        service_assignment: desired,
        cleared_assignments: current !== desired,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error in PATCH /api/services/assignment-level');
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json(
        { error: { code: 'ORG_CONTEXT_REQUIRED', message: 'Organization context required' } },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === 'ORG_FORBIDDEN') {
      return NextResponse.json(
        { error: { code: 'ORG_FORBIDDEN', message: 'Forbidden: organization access denied' } },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}

