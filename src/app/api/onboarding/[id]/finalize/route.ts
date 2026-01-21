import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/onboarding/:id/finalize
 * Revalidate and set READY_TO_SEND
 *
 * - Revalidates property basics + owners/signers + units
 * - Sets status READY_TO_SEND
 * - Returns { onboarding, property }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { supabase: db, user } = await requireAuth();
    const { id: onboardingId } = await context.params;
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    // Fetch onboarding with property
    const { data: onboarding, error: fetchError } = await db
      .from('property_onboarding')
      .select(
        `
        id,
        property_id,
        org_id,
        status,
        progress,
        current_stage,
        properties (
          id,
          name,
          address_line1,
          city,
          state,
          postal_code,
          country,
          property_type
        )
      `,
      )
      .eq('id', onboardingId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !onboarding) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Onboarding not found' } },
        { status: 404 },
      );
    }

    const propertyId = onboarding.property_id;
    const propertyRecord = Array.isArray(onboarding.properties)
      ? onboarding.properties[0]
      : onboarding.properties;

    if (!propertyRecord) {
      return NextResponse.json(
        { error: { code: 'PROPERTY_NOT_FOUND', message: 'Property details missing on onboarding' } },
        { status: 404 },
      );
    }

    const property = propertyRecord as {
      id: string;
      name: string;
      address_line1: string;
      city: string | null;
      state: string | null;
      postal_code: string;
      country: string;
      property_type: string;
    };

    // Validate property basics
    const propertyIssues: string[] = [];
    if (!property.name) propertyIssues.push('Property name is required');
    if (!property.address_line1) propertyIssues.push('Address is required');
    if (!property.postal_code) propertyIssues.push('Postal code is required');
    if (!property.country) propertyIssues.push('Country is required');

    if (propertyIssues.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'PROPERTY_VALIDATION_FAILED',
            message: 'Property validation failed',
            issues: propertyIssues,
          },
        },
        { status: 422 },
      );
    }

    // Validate owners exist
    const { count: ownershipCount, error: ownershipError } = await db
      .from('ownerships')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId);

    if (ownershipError) {
      logger.error({ error: ownershipError }, 'Failed to count ownerships');
    }

    if (!ownershipCount || ownershipCount === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_OWNERS',
            message: 'At least one owner is required',
          },
        },
        { status: 422 },
      );
    }

    // Validate signers exist in current_stage
    const currentStage = (onboarding.current_stage as Record<string, unknown>) || {};
    const signers = (currentStage.signers as Array<{ email: string }>) || [];
    const hasSignerEmail = signers.some((s) => s.email);

    if (!hasSignerEmail) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_SIGNER_EMAIL',
            message: 'At least one signer email is required',
          },
        },
        { status: 422 },
      );
    }

    // Validate units exist
    const { count: unitCount, error: unitError } = await db
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', propertyId);

    if (unitError) {
      logger.error({ error: unitError }, 'Failed to count units');
    }

    if (!unitCount || unitCount === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_UNITS',
            message: 'At least one unit is required',
          },
        },
        { status: 422 },
      );
    }

    // Update onboarding status to READY_TO_SEND
    const { data: updatedOnboarding, error: updateError } = await db
      .from('property_onboarding')
      .update({
        status: 'READY_TO_SEND',
        progress: 80,
      })
      .eq('id', onboardingId)
      .select()
      .single();

    if (updateError || !updatedOnboarding) {
      logger.error({ error: updateError }, 'Failed to update onboarding status');
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: updateError?.message || 'Failed to update' } },
        { status: 500 },
      );
    }

    return NextResponse.json({
      onboarding: {
        id: updatedOnboarding.id,
        propertyId: updatedOnboarding.property_id,
        orgId: updatedOnboarding.org_id,
        status: updatedOnboarding.status,
        progress: updatedOnboarding.progress,
        currentStage: updatedOnboarding.current_stage,
        createdAt: updatedOnboarding.created_at,
        updatedAt: updatedOnboarding.updated_at,
      },
      property: {
        id: property.id,
        name: property.name,
        addressLine1: property.address_line1,
        city: property.city,
        state: property.state,
        postalCode: property.postal_code,
        country: property.country,
        propertyType: property.property_type,
      },
    });
  } catch (error) {
    logger.error({ error }, 'POST /api/onboarding/:id/finalize failed');

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
