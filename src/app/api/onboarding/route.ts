import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';
import { buildNormalizedAddressKey } from '@/lib/normalized-address';
import {
  normalizePropertyType,
  normalizeAssignmentLevel,
  normalizeCountryWithDefault,
} from '@/lib/normalizers';
import { OnboardingCreateSchema, type OnboardingCreateResponse } from '@/schemas/onboarding';
import { logger } from '@/lib/logger';

/**
 * POST /api/onboarding
 * Create property + onboarding stub (single entry point for onboarding flow)
 *
 * - Uses buildNormalizedAddressKey() for deduplication
 * - Returns 409 if duplicate draft exists for same normalized address/org
 * - Creates property stub (status=Active) + onboarding row (status=DRAFT)
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase: db, user } = await requireAuth();
    const body = await request.json();

    // Validate request body
    const parseResult = OnboardingCreateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: parseResult.error.message } },
        { status: 400 },
      );
    }

    const data = parseResult.data;

    // Resolve organization context
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    // Build normalized address key for deduplication
    const addressResult = buildNormalizedAddressKey({
      addressLine1: data.addressLine1,
      city: data.city,
      state: data.state,
      postalCode: data.postalCode,
      country: data.country,
      borough: data.borough,
    });

    const normalizedAddressKey = addressResult?.normalizedAddressKey ?? null;

    // Check for existing open onboarding with same normalized address/org
    if (normalizedAddressKey) {
      const { data: existingOnboarding, error: checkError } = await db
        .from('property_onboarding')
        .select('id, property_id, status')
        .eq('org_id', orgId)
        .eq('normalized_address_key', normalizedAddressKey)
        .in('status', ['DRAFT', 'OWNERS_ADDED', 'UNITS_ADDED', 'READY_TO_SEND'])
        .maybeSingle();

      if (checkError) {
        logger.error({ error: checkError }, 'Failed to check for existing onboarding');
      }

      if (existingOnboarding) {
        return NextResponse.json(
          {
            error: {
              code: 'DUPLICATE_DRAFT',
              message: 'An onboarding draft already exists for this address',
            },
            existingOnboardingId: existingOnboarding.id,
            existingPropertyId: existingOnboarding.property_id,
          },
          { status: 409 },
        );
      }
    }

    // Normalize property type and other enums
    const normalizedPropertyType = normalizePropertyType(data.propertyType);
    const normalizedCountry = normalizeCountryWithDefault(data.country);
    const normalizedServiceAssignment = data.serviceAssignment
      ? normalizeAssignmentLevel(data.serviceAssignment)
      : null;

    // Generate property name if not provided
    const propertyName = data.name || `${data.addressLine1}, ${data.city || data.postalCode}`;

    // Create property stub
    const { data: property, error: propertyError } = await db
      .from('properties')
      .insert({
        name: propertyName.substring(0, 127),
        address_line1: data.addressLine1,
        address_line2: data.addressLine2 || null,
        address_line3: data.addressLine3 || null,
        city: data.city || null,
        state: data.state || null,
        postal_code: data.postalCode,
        country: normalizedCountry,
        borough: data.borough || null,
        neighborhood: data.neighborhood || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        property_type: normalizedPropertyType,
        service_assignment: normalizedServiceAssignment,
        management_scope: data.managementScope || null,
        status: 'Active',
        org_id: orgId,
      })
      .select()
      .single();

    if (propertyError || !property) {
      logger.error({ error: propertyError }, 'Failed to create property stub');
      return NextResponse.json(
        { error: { code: 'PROPERTY_CREATE_FAILED', message: propertyError?.message || 'Failed to create property' } },
        { status: 500 },
      );
    }

    // Create onboarding record
    const { data: onboarding, error: onboardingError } = await db
      .from('property_onboarding')
      .insert({
        property_id: property.id,
        org_id: orgId,
        status: 'DRAFT',
        progress: 0,
        current_stage: {},
        normalized_address_key: normalizedAddressKey,
      })
      .select()
      .single();

    if (onboardingError || !onboarding) {
      // Rollback property creation
      await db.from('properties').delete().eq('id', property.id);
      logger.error({ error: onboardingError }, 'Failed to create onboarding record');
      return NextResponse.json(
        { error: { code: 'ONBOARDING_CREATE_FAILED', message: onboardingError?.message || 'Failed to create onboarding' } },
        { status: 500 },
      );
    }

    const response: OnboardingCreateResponse = {
      property: {
        id: property.id,
        name: property.name,
        addressLine1: property.address_line1,
        city: property.city,
        state: property.state,
        postalCode: property.postal_code,
        country: property.country,
      },
      onboarding: {
        id: onboarding.id,
        propertyId: onboarding.property_id,
        orgId: onboarding.org_id,
        status: onboarding.status,
        progress: onboarding.progress,
        currentStage: onboarding.current_stage as Record<string, unknown>,
        normalizedAddressKey: onboarding.normalized_address_key,
        createdAt: onboarding.created_at,
        updatedAt: onboarding.updated_at,
      },
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error({ error }, 'POST /api/onboarding failed');

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
 * GET /api/onboarding
 * List onboarding drafts for the current org
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase: db, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, db);
    await requireOrgMember({ client: db, userId: user.id, orgId });

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    let query = db
      .from('property_onboarding')
      .select(
        `
        id,
        property_id,
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
          city,
          state,
          postal_code
        )
      `,
      )
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: drafts, error } = await query;

    if (error) {
      logger.error({ error }, 'Failed to fetch onboarding drafts');
      return NextResponse.json(
        { error: { code: 'FETCH_FAILED', message: error.message } },
        { status: 500 },
      );
    }

    return NextResponse.json({ drafts: drafts || [] });
  } catch (error) {
    logger.error({ error }, 'GET /api/onboarding failed');

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
