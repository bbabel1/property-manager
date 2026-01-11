/**
 * Statement Recipients API
 *
 * Manages the list of email recipients for monthly statement delivery.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { requireOrgMember, resolveResourceOrg } from '@/lib/auth/org-guards';
import { hasPermission } from '@/lib/permissions';

// Recipient validation schema
const recipientSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.string().min(1),
});

const updateRecipientsSchema = z.object({
  recipients: z.array(recipientSchema),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { supabase, user, roles } = auth;
    if (!hasPermission(roles, 'monthly_logs.write')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { id: propertyId } = await params;
    const body = await request.json();

    const resolved = await resolveResourceOrg(supabase, 'property', propertyId);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }
    try {
      await requireOrgMember({ client: supabase, userId: user.id, orgId: resolved.orgId });
    } catch (memberErr) {
      const msg = memberErr instanceof Error ? memberErr.message : '';
      const status = msg === 'ORG_FORBIDDEN' ? 403 : 401;
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status },
      );
    }
    const orgId = resolved.orgId;

    // Validate request
    const validation = updateRecipientsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: validation.error.issues,
          },
        },
        { status: 400 },
      );
    }

    const { recipients } = validation.data;

    // Ensure the property exists before attempting to update recipients
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('id, bin, borough, city')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .maybeSingle();

    if (propertyError || !property) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    // Comply with NYC BIN constraint to avoid DB check failures
    const nycBoroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island'];
    const isNyProperty =
      (property.borough && nycBoroughs.includes(property.borough)) ||
      (property.city && property.city.toLowerCase() === 'new york');

    if (isNyProperty && !property.bin) {
      return NextResponse.json(
        {
          error: {
            code: 'BIN_REQUIRED',
            message: 'NYC properties must have a BIN before updating statement recipients.',
          },
        },
        { status: 400 },
      );
    }

    // Update property statement recipients
    const { error: updateError } = await supabase
      .from('properties')
      .update({ statement_recipients: recipients })
      .eq('id', propertyId)
      .eq('org_id', orgId);

    if (updateError) {
      console.error('Error updating statement recipients:', updateError);
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: 'Failed to update statement recipients' } },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in PATCH /api/properties/[id]/statement-recipients:', error);

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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { supabase, user, roles } = auth;
    if (!hasPermission(roles, 'monthly_logs.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { id: propertyId } = await params;

    const resolved = await resolveResourceOrg(supabase, 'property', propertyId);
    if (!resolved.ok) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }
    try {
      await requireOrgMember({ client: supabase, userId: user.id, orgId: resolved.orgId });
    } catch (memberErr) {
      const msg = memberErr instanceof Error ? memberErr.message : '';
      const status = msg === 'ORG_FORBIDDEN' ? 403 : 401;
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status },
      );
    }
    const orgId = resolved.orgId;

    // Fetch property statement recipients
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('statement_recipients')
      .eq('id', propertyId)
      .eq('org_id', orgId)
      .single();

    if (propertyError || !property) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({
      recipients: property.statement_recipients || [],
    });
  } catch (error) {
    console.error('Error in GET /api/properties/[id]/statement-recipients:', error);

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
