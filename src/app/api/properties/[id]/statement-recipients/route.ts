/**
 * Statement Recipients API
 *
 * Manages the list of email recipients for monthly statement delivery.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/auth/guards';
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

const isDevBypass = process.env.NODE_ENV === 'development';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isDevBypass) {
      const auth = await requireAuth();
      if (!hasPermission(auth.roles, 'monthly_logs.write')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
          { status: 403 },
        );
      }
    }

    // Parse parameters
    const { id: propertyId } = await params;
    const body = await request.json();

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

    // Update property statement recipients
    const { error: updateError } = await supabaseAdmin
      .from('properties')
      .update({ statement_recipients: recipients })
      .eq('id', propertyId);

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

    if (!isDevBypass && error instanceof Error && error.message === 'UNAUTHENTICATED') {
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
    if (!isDevBypass) {
      const auth = await requireAuth();
      if (!hasPermission(auth.roles, 'monthly_logs.read')) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
          { status: 403 },
        );
      }
    }

    // Parse parameters
    const { id: propertyId } = await params;

    // Fetch property statement recipients
    const { data: property, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('statement_recipients')
      .eq('id', propertyId)
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

    if (!isDevBypass && error instanceof Error && error.message === 'UNAUTHENTICATED') {
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
