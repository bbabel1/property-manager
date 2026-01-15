import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';
import { OnboardingOwnersSchema, type OnboardingOwnerInput } from '@/schemas/onboarding';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/onboarding/:id/owners
 * Upsert/delete owners for an onboarding
 *
 * - Uses clientRowId for idempotent upserts
 * - Validates ownership sums to 100% (422 if invalid)
 * - Requires ≥1 signer email (422 if missing)
 * - Writes ownerships rows immediately (not staged)
 * - Sets status OWNERS_ADDED when valid
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { supabase: db, user } = await requireAuth();
    const { id: onboardingId } = await context.params;
    const body = await request.json();

    // Validate request body
    const parseResult = OnboardingOwnersSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
        { status: 400 },
      );
    }

    const { owners } = parseResult.data;
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    // Fetch onboarding to get property_id
    const { data: onboarding, error: fetchError } = await db
      .from('property_onboarding')
      .select('id, property_id, org_id, status, current_stage')
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

    // Separate owners to delete vs upsert
    const toDelete = owners.filter((o) => o.deleted);
    const toUpsert = owners.filter((o) => !o.deleted);

    // Validate ownership percentages sum to 100%
    const totalOwnership = toUpsert.reduce((sum, o) => sum + o.ownershipPercentage, 0);
    if (toUpsert.length > 0 && Math.abs(totalOwnership - 100) > 0.01) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_OWNERSHIP_SUM',
            message: `Ownership percentages must sum to 100% (current: ${totalOwnership}%)`,
          },
        },
        { status: 422 },
      );
    }

    // Validate at least one signer email
    const hasSignerEmail = toUpsert.some((o) => o.signerEmail);
    if (toUpsert.length > 0 && !hasSignerEmail) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_SIGNER_EMAIL',
            message: 'At least one owner must have a signer email',
          },
        },
        { status: 422 },
      );
    }

    // Process deletions
    for (const owner of toDelete) {
      if (owner.ownerId) {
        await db
          .from('ownerships')
          .delete()
          .eq('property_id', propertyId)
          .eq('owner_id', owner.ownerId);
      }
    }

    // Process upserts
    const upsertedOwnerships: Array<{
      id: string;
      ownerId: string;
      ownershipPercentage: number;
      disbursementPercentage: number;
      primary: boolean;
    }> = [];

    for (const ownerInput of toUpsert) {
      let ownerId = ownerInput.ownerId;

      // Create new owner if ownerPayload provided and no ownerId
      if (!ownerId && ownerInput.ownerPayload) {
        const { ownerPayload } = ownerInput;

        // Create contact first
        const { data: contact, error: contactError } = await db
          .from('contacts')
          .insert({
            first_name: ownerPayload.firstName || null,
            last_name: ownerPayload.lastName || null,
            is_company: ownerPayload.isCompany || false,
            company_name: ownerPayload.companyName || null,
            primary_email: ownerPayload.primaryEmail || ownerInput.signerEmail || null,
            primary_phone: ownerPayload.primaryPhone || null,
          })
          .select()
          .single();

        if (contactError || !contact) {
          logger.error({ error: contactError }, 'Failed to create contact');
          continue;
        }

        // Create owner
        const { data: newOwner, error: ownerError } = await db
          .from('owners')
          .insert({
            contact_id: contact.id,
            org_id: orgId,
          })
          .select()
          .single();

        if (ownerError || !newOwner) {
          logger.error({ error: ownerError }, 'Failed to create owner');
          continue;
        }

        ownerId = newOwner.id;
      }

      if (!ownerId) {
        logger.warn({ ownerInput }, 'No ownerId and no ownerPayload provided');
        continue;
      }

      // Backfill owners.org_id if needed
      await db.from('owners').update({ org_id: orgId }).eq('id', ownerId).is('org_id', null);

      // Upsert ownership
      const { data: ownership, error: ownershipError } = await db
        .from('ownerships')
        .upsert(
          {
            property_id: propertyId,
            owner_id: ownerId,
            ownership_percentage: ownerInput.ownershipPercentage,
            disbursement_percentage: ownerInput.disbursementPercentage ?? ownerInput.ownershipPercentage,
            primary: ownerInput.primary ?? false,
            org_id: orgId,
          },
          {
            onConflict: 'property_id,owner_id',
          },
        )
        .select()
        .single();

      if (ownershipError) {
        logger.error({ error: ownershipError }, 'Failed to upsert ownership');
        continue;
      }

      if (ownership) {
        upsertedOwnerships.push({
          id: ownership.id,
          ownerId: ownership.owner_id,
          ownershipPercentage: ownership.ownership_percentage,
          disbursementPercentage: ownership.disbursement_percentage,
          primary: ownership.primary,
        });
      }
    }

    // Store signer info in current_stage
    const signers = toUpsert
      .filter((o) => o.signerEmail)
      .map((o) => ({
        clientRowId: o.clientRowId,
        email: o.signerEmail,
        name: o.signerName || null,
        ownerId: o.ownerId,
      }));

    const currentStage = (onboarding.current_stage as Record<string, unknown>) || {};
    const updatedCurrentStage = {
      ...currentStage,
      signers,
      ownerClientRowIds: toUpsert.map((o) => o.clientRowId),
    };

    // Update onboarding status to OWNERS_ADDED
    const { data: updatedOnboarding, error: updateError } = await db
      .from('property_onboarding')
      .update({
        status: 'OWNERS_ADDED',
        current_stage: updatedCurrentStage,
        progress: Math.max((onboarding.progress as number) || 0, 40),
      })
      .eq('id', onboardingId)
      .select()
      .single();

    if (updateError) {
      logger.error({ error: updateError }, 'Failed to update onboarding status');
    }

    return NextResponse.json({
      onboarding: updatedOnboarding
        ? {
            id: updatedOnboarding.id,
            propertyId: updatedOnboarding.property_id,
            orgId: updatedOnboarding.org_id,
            status: updatedOnboarding.status,
            progress: updatedOnboarding.progress,
            currentStage: updatedOnboarding.current_stage,
            createdAt: updatedOnboarding.created_at,
            updatedAt: updatedOnboarding.updated_at,
          }
        : null,
      ownerships: upsertedOwnerships,
    });
  } catch (error) {
    logger.error({ error }, 'POST /api/onboarding/:id/owners failed');

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
