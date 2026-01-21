import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';
import { OnboardingUnitsSchema, type OnboardingUnitInput } from '@/schemas/onboarding';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/onboarding/:id/units
 * Upsert/delete units for an onboarding
 *
 * - Uses clientRowId for idempotent upserts
 * - Enforces unique unit_number per property (422 if duplicate)
 * - Writes units rows immediately (not staged)
 * - Sets status UNITS_ADDED when ≥1 unit
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { supabase: db, user } = await requireAuth();
    const { id: onboardingId } = await context.params;
    const body = await request.json();

    // Validate request body
    const parseResult = OnboardingUnitsSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
        { status: 400 },
      );
    }

    const { units } = parseResult.data;
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    // Fetch onboarding to get property_id
    const { data: onboarding, error: fetchError } = await db
      .from('property_onboarding')
      .select('id, property_id, org_id, status, progress, current_stage')
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

    // Fetch property for country default
    const { data: property } = await db
      .from('properties')
      .select('country')
      .eq('id', propertyId)
      .single();

    const defaultCountry = property?.country || 'United States';

    // Separate units to delete vs upsert
    const toDelete = units.filter((u) => u.deleted);
    const toUpsert = units.filter((u) => !u.deleted);

    // Check for duplicate unit numbers within the request
    const unitNumbers = toUpsert.map((u) => u.unitNumber);
    const duplicatesInRequest = unitNumbers.filter(
      (num, idx) => unitNumbers.indexOf(num) !== idx,
    );
    if (duplicatesInRequest.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'DUPLICATE_UNIT_NUMBER',
            message: `Duplicate unit numbers in request: ${duplicatesInRequest.join(', ')}`,
          },
        },
        { status: 422 },
      );
    }

    // Get existing units for this property to check for duplicates
    const { data: existingUnits } = await db
      .from('units')
      .select('id, unit_number')
      .eq('property_id', propertyId);

    const existingUnitNumbers = new Set(
      (existingUnits || []).map((u) => u.unit_number?.toLowerCase()),
    );

    // Track clientRowId to unit id mapping from current_stage
    const currentStage = (onboarding.current_stage as Record<string, unknown>) || {};
    const unitClientRowMap = (currentStage.unitClientRowMap as Record<string, string>) || {};

    // Process deletions
    for (const unit of toDelete) {
      const existingUnitId = unitClientRowMap[unit.clientRowId];
      if (existingUnitId) {
        await db.from('units').delete().eq('id', existingUnitId).eq('property_id', propertyId);
        delete unitClientRowMap[unit.clientRowId];
      }
    }

    // Process upserts
    const upsertedUnits: Array<{
      id: string;
      clientRowId: string;
      unitNumber: string;
      unitBedrooms: string | null;
      unitBathrooms: string | null;
      unitSize: number | null;
    }> = [];

    for (const unitInput of toUpsert) {
      const existingUnitId = unitClientRowMap[unitInput.clientRowId];

      // Check for duplicate unit number (excluding the unit being updated)
      const unitNumberLower = unitInput.unitNumber.toLowerCase();
      if (!existingUnitId && existingUnitNumbers.has(unitNumberLower)) {
        return NextResponse.json(
          {
            error: {
              code: 'DUPLICATE_UNIT_NUMBER',
              message: `Unit number "${unitInput.unitNumber}" already exists for this property`,
            },
          },
          { status: 422 },
        );
      }

      if (existingUnitId) {
        // Update existing unit
        const { data: unit, error: updateError } = await db
          .from('units')
          .update({
            unit_number: unitInput.unitNumber,
            unit_bedrooms: unitInput.unitBedrooms || null,
            unit_bathrooms: unitInput.unitBathrooms || null,
            unit_size: unitInput.unitSize || null,
            description: unitInput.description || null,
          })
          .eq('id', existingUnitId)
          .select()
          .single();

        if (updateError) {
          logger.error({ error: updateError }, 'Failed to update unit');
          continue;
        }

        if (unit) {
          upsertedUnits.push({
            id: unit.id,
            clientRowId: unitInput.clientRowId,
            unitNumber: unit.unit_number,
            unitBedrooms: unit.unit_bedrooms,
            unitBathrooms: unit.unit_bathrooms,
            unitSize: unit.unit_size,
          });
        }
      } else {
        // Create new unit
        const { data: unit, error: insertError } = await db
          .from('units')
          .insert({
            property_id: propertyId,
            unit_number: unitInput.unitNumber,
            unit_bedrooms: unitInput.unitBedrooms || null,
            unit_bathrooms: unitInput.unitBathrooms || null,
            unit_size: unitInput.unitSize || null,
            description: unitInput.description || null,
            country: defaultCountry,
            status: 'Vacant',
            org_id: orgId,
          })
          .select()
          .single();

        if (insertError) {
          logger.error({ error: insertError }, 'Failed to create unit');
          continue;
        }

        if (unit) {
          unitClientRowMap[unitInput.clientRowId] = unit.id;
          existingUnitNumbers.add(unitInput.unitNumber.toLowerCase());
          upsertedUnits.push({
            id: unit.id,
            clientRowId: unitInput.clientRowId,
            unitNumber: unit.unit_number,
            unitBedrooms: unit.unit_bedrooms,
            unitBathrooms: unit.unit_bathrooms,
            unitSize: unit.unit_size,
          });
        }
      }
    }

    // Update current_stage with unit mapping
    const updatedCurrentStage = {
      ...currentStage,
      unitClientRowMap,
      unitClientRowIds: toUpsert.map((u) => u.clientRowId),
    };

    // Update onboarding status to UNITS_ADDED if we have at least one unit
    const totalUnits = upsertedUnits.length;
    const newStatus = totalUnits > 0 ? 'UNITS_ADDED' : onboarding.status;

    const { data: updatedOnboarding, error: updateError } = await db
      .from('property_onboarding')
      .update({
        status: newStatus,
        current_stage: updatedCurrentStage,
        progress: Math.max((onboarding.progress as number) || 0, 60),
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
      units: upsertedUnits,
    });
  } catch (error) {
    logger.error({ error }, 'POST /api/onboarding/:id/units failed');

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
