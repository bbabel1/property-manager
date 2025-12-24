/**
 * Email Template by ID API Routes
 *
 * GET /api/email-templates/[id] - Get template by ID
 * PUT /api/email-templates/[id] - Full update with optimistic concurrency
 * PATCH /api/email-templates/[id] - Partial update with optimistic concurrency
 * DELETE /api/email-templates/[id] - Archive template (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireUser } from '@/lib/auth';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import {
  updateEmailTemplate,
  archiveEmailTemplate,
} from '@/lib/email-template-service';
import { EmailTemplateUpdateSchema } from '@/types/email-templates';
import { supabaseAdmin } from '@/lib/db';

/**
 * GET /api/email-templates/[id]
 * Get template by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);
    const { id } = await params;

    const { data: template, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !template) {
      return NextResponse.json(
        {
          error: {
            code: 'TEMPLATE_NOT_FOUND',
            message: 'Template not found',
          },
        },
        { status: 404 },
      );
    }

    const availableVariables = Array.isArray(template.available_variables)
      ? template.available_variables
      : JSON.parse(JSON.stringify(template.available_variables || []));

    return NextResponse.json({
      ...template,
      available_variables: availableVariables,
    });
  } catch (error) {
    console.error('Error fetching email template:', error);
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'ORG_FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden: organization access denied' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

/**
 * PUT /api/email-templates/[id]
 * Full update with optimistic concurrency
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);
    const { id } = await params;

    // Check user role
    const { data: membership } = await supabaseAdmin
      .from('org_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single();

    const role = membership && 'role' in membership ? (membership as { role?: string }).role : undefined;
    if (!role || !['org_admin', 'org_manager', 'platform_admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden: Admin or Manager role required' }, { status: 403 });
    }

    const body = await request.json();
    const validated = EmailTemplateUpdateSchema.parse(body);

    // Check for optimistic concurrency conflict
    if (validated.updated_at) {
      const { data: current } = await supabaseAdmin
        .from('email_templates')
        .select('updated_at')
        .eq('id', id)
        .eq('org_id', orgId)
        .single();

      if (current?.updated_at !== validated.updated_at) {
        return NextResponse.json(
          {
            error: {
              code: 'TEMPLATE_CONFLICT',
              message: 'Template was modified by another user. Please refresh and try again.',
            },
          },
          { status: 409 },
        );
      }
    }

    const template = await updateEmailTemplate(orgId, id, validated, user.id, validated.updated_at);

    if (!template) {
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    return NextResponse.json(template);
  } catch (error: unknown) {
    console.error('Error updating email template:', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: error.issues,
            formatted: error.format(),
          },
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'TEMPLATE_CONFLICT') {
      return NextResponse.json(
        {
          error: {
            code: 'TEMPLATE_CONFLICT',
            message: 'Template was modified by another user. Please refresh and try again.',
          },
        },
        { status: 409 },
      );
    }

    if (error instanceof Error && error.message?.includes('Invalid variables')) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_VARIABLES',
            message: error.message ?? 'Invalid variables provided',
          },
        },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'ORG_FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden: organization access denied' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

/**
 * PATCH /api/email-templates/[id]
 * Partial update with optimistic concurrency
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Same as PUT but with partial validation
  return PUT(request, { params });
}

/**
 * DELETE /api/email-templates/[id]
 * Archive template (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);
    const { id } = await params;

    // Check user role
    const { data: membership } = await supabaseAdmin
      .from('org_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single();

    const role = membership && 'role' in membership ? (membership as { role?: string }).role : undefined;
    if (!role || !['org_admin', 'org_manager', 'platform_admin'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden: Admin or Manager role required' }, { status: 403 });
    }

    const success = await archiveEmailTemplate(orgId, id, user.id);

    if (!success) {
      return NextResponse.json({ error: 'Failed to archive template' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error archiving email template:', error);
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'ORG_FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden: organization access denied' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to archive template' }, { status: 500 });
  }
}
