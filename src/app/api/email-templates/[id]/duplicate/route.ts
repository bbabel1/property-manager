/**
 * Duplicate Email Template API Route
 *
 * POST /api/email-templates/[id]/duplicate - Duplicate an existing template with a new key
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireUser } from '@/lib/auth';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { supabaseAdmin } from '@/lib/db';
import { duplicateEmailTemplate } from '@/lib/email-template-service';

const DuplicateSchema = z.object({
  template_key: z.string().min(1).max(255).optional(),
});

export async function POST(
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

    const body = await request.json().catch(() => ({}));
    const validated = DuplicateSchema.parse(body);

    // Fetch template to derive default key
    const { data: original } = await supabaseAdmin
      .from('email_templates')
      .select('template_key')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();

    if (!original) {
      return NextResponse.json(
        { error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found' } },
        { status: 404 },
      );
    }

    const newKey = validated.template_key || `${original.template_key}_copy`;

    const duplicated = await duplicateEmailTemplate(orgId, id, newKey, user.id);

    if (!duplicated) {
      return NextResponse.json({ error: 'Failed to duplicate template' }, { status: 500 });
    }

    return NextResponse.json(duplicated, { status: 201 });
  } catch (error: unknown) {
    console.error('Error duplicating email template:', error);

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

    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }

    if (error instanceof Error && error.message === 'ORG_FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden: organization access denied' }, { status: 403 });
    }

    if (error instanceof Error && error.message === 'Template key already exists') {
      return NextResponse.json(
        {
          error: {
            code: 'TEMPLATE_KEY_EXISTS',
            message: 'Template key already exists for this organization',
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: 'Failed to duplicate template' }, { status: 500 });
  }
}
