import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';
import {
  OnboardingUpdateSchema,
  isValidStatusTransition,
  type OnboardingStatus,
  type OnboardingResponse,
} from '@/schemas/onboarding';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/onboarding/:id
 * Load draft state (resume)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { supabase: db, user } = await requireAuth();
    const { id } = await context.params;
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    const { data: onboarding, error } = await db
      .from('property_onboarding')
      .select(
        `
        id,
        property_id,
        org_id,
        status,
        progress,
        current_stage,
        normalized_address_key,
        created_at,
        updated_at,
        properties (
          id,
          name,
          address_line1,
          address_line2,
          address_line3,
          city,
          state,
          postal_code,
          country,
          property_type,
          service_assignment,
          management_scope
        )
      `,
      )
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !onboarding) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Onboarding not found' } },
        { status: 404 },
      );
    }

    const response: OnboardingResponse & { property: unknown } = {
      id: onboarding.id,
      propertyId: onboarding.property_id,
      orgId: onboarding.org_id,
      status: onboarding.status as OnboardingStatus,
      progress: onboarding.progress,
      currentStage: onboarding.current_stage as Record<string, unknown>,
      normalizedAddressKey: onboarding.normalized_address_key,
      createdAt: onboarding.created_at,
      updatedAt: onboarding.updated_at,
      property: onboarding.properties,
    };

    return NextResponse.json({ onboarding: response });
  } catch (error) {
    logger.error({ error }, 'GET /api/onboarding/:id failed');

    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }, { status: 401 });
      }
      if (error.message === 'ORG_FORBIDDEN' || error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: { code: error.message, message: 'Organization access denied' } }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/onboarding/:id
 * Autosave draft state
 * - Server enforces legal status transitions only
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { supabase: db, user } = await requireAuth();
    const { id } = await context.params;
    const body = await request.json();

    // Validate request body
    const parseResult = OnboardingUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    // Fetch current onboarding to validate status transition
    const { data: currentOnboarding, error: fetchError } = await db
      .from('property_onboarding')
      .select('id, status, org_id')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !currentOnboarding) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Onboarding not found' } },
        { status: 404 },
      );
    }

    // Validate status transition if status is being updated
    if (data.status && data.status !== currentOnboarding.status) {
      const currentStatus = currentOnboarding.status as OnboardingStatus;
      if (!isValidStatusTransition(currentStatus, data.status)) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_STATUS_TRANSITION',
              message: `Cannot transition from ${currentStatus} to ${data.status}`,
            },
          },
          { status: 422 },
        );
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (data.currentStage !== undefined) {
      updateData.current_stage = data.currentStage;
    }
    if (data.progress !== undefined) {
      updateData.progress = data.progress;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: { code: 'NO_CHANGES', message: 'No fields to update' } },
        { status: 400 },
      );
    }

    const { data: onboarding, error: updateError } = await db
      .from('property_onboarding')
      .update(updateData)
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single();

    if (updateError || !onboarding) {
      logger.error({ error: updateError }, 'Failed to update onboarding');
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: updateError?.message || 'Failed to update' } },
        { status: 500 },
      );
    }

    const response: OnboardingResponse = {
      id: onboarding.id,
      propertyId: onboarding.property_id,
      orgId: onboarding.org_id,
      status: onboarding.status as OnboardingStatus,
      progress: onboarding.progress,
      currentStage: onboarding.current_stage as Record<string, unknown>,
      normalizedAddressKey: onboarding.normalized_address_key,
      createdAt: onboarding.created_at,
      updatedAt: onboarding.updated_at,
    };

    return NextResponse.json({ onboarding: response });
  } catch (error) {
    logger.error({ error }, 'PATCH /api/onboarding/:id failed');

    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }, { status: 401 });
      }
      if (error.message === 'ORG_FORBIDDEN' || error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: { code: error.message, message: 'Organization access denied' } }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/onboarding/:id
 * Cancel draft (only for DRAFT status)
 * - Cleans stub property and children if unused
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { supabase: db, user } = await requireAuth();
    const { id } = await context.params;
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    // Fetch current onboarding
    const { data: onboarding, error: fetchError } = await db
      .from('property_onboarding')
      .select('id, status, property_id, org_id')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !onboarding) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Onboarding not found' } },
        { status: 404 },
      );
    }

    // Only allow deletion of DRAFT status
    if (onboarding.status !== 'DRAFT') {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STATUS',
            message: 'Can only delete onboarding in DRAFT status',
          },
        },
        { status: 400 },
      );
    }

    // Check if property has any downstream references (units, leases, etc.)
    const { count: unitCount } = await db
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', onboarding.property_id);

    const { count: ownershipCount } = await db
      .from('ownerships')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', onboarding.property_id);

    if ((unitCount && unitCount > 0) || (ownershipCount && ownershipCount > 0)) {
      return NextResponse.json(
        {
          error: {
            code: 'HAS_DOWNSTREAM_REFERENCES',
            message: 'Cannot delete onboarding with existing units or ownerships',
          },
        },
        { status: 422 },
      );
    }

    // Delete onboarding record
    const { error: deleteOnboardingError } = await db
      .from('property_onboarding')
      .delete()
      .eq('id', id);

    if (deleteOnboardingError) {
      logger.error({ error: deleteOnboardingError }, 'Failed to delete onboarding');
      return NextResponse.json(
        { error: { code: 'DELETE_FAILED', message: deleteOnboardingError.message } },
        { status: 500 },
      );
    }

    // Delete property stub
    const { error: deletePropertyError } = await db
      .from('properties')
      .delete()
      .eq('id', onboarding.property_id);

    if (deletePropertyError) {
      logger.error({ error: deletePropertyError }, 'Failed to delete property stub');
      // Don't fail the request - onboarding is already deleted
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error({ error }, 'DELETE /api/onboarding/:id failed');

    if (error instanceof Error) {
      if (error.message === 'UNAUTHENTICATED') {
        return NextResponse.json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } }, { status: 401 });
      }
      if (error.message === 'ORG_FORBIDDEN' || error.message === 'ORG_CONTEXT_REQUIRED') {
        return NextResponse.json({ error: { code: error.message, message: 'Organization access denied' } }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
