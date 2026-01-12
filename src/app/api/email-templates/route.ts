/**
 * Email Templates API Routes
 *
 * GET /api/email-templates - List templates with pagination and filtering
 * POST /api/email-templates - Create new template
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireAuth } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { createEmailTemplate } from '@/lib/email-template-service';
import { EmailTemplateInsertSchema } from '@/types/email-templates';
import { requireOrgAdmin, requireOrgMember } from '@/lib/auth/org-guards';

/**
 * GET /api/email-templates
 * List email templates with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);
    await requireOrgMember({ client: supabase, userId: user.id, orgId });

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'active' | 'inactive' | 'archived' | null;
    const templateKey = url.searchParams.get('templateKey');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

    const offset = (page - 1) * limit;

    let query = supabase
      .from('email_templates')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId);

    if (status && ['active', 'inactive', 'archived'].includes(status)) {
      query = query.eq('status', status);
    }
    if (templateKey) {
      query = query.eq('template_key', templateKey);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching email templates:', error);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    const templates = (data || []).map((template) => {
      const availableVariables = Array.isArray(template.available_variables)
        ? template.available_variables
        : JSON.parse(JSON.stringify(template.available_variables || []));
      return { ...template, available_variables: availableVariables };
    });

    return NextResponse.json({
      templates,
      pagination: {
        page,
        limit,
        total: count ?? templates.length,
        totalPages: Math.ceil((count ?? templates.length) / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching email templates:', error);
    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'ORG_FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden: organization access denied' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

/**
 * POST /api/email-templates
 * Create new email template
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase, user, roles } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);

    await requireOrgAdmin({ client: supabase, userId: user.id, orgId, roles });

    const body = await request.json();
    const validated = EmailTemplateInsertSchema.parse({
      ...body,
      org_id: orgId,
    });

    // Check if template_key already exists for this org
    const existing = await supabase
      .from('email_templates')
      .select('id')
      .eq('org_id', orgId)
      .eq('template_key', validated.template_key)
      .maybeSingle();

    if (existing.data) {
      return NextResponse.json(
        {
          error: {
            code: 'TEMPLATE_KEY_EXISTS',
            message: `Template with key '${validated.template_key}' already exists for this organization`,
          },
        },
        { status: 409 },
      );
    }

    const template = await createEmailTemplate(orgId, validated, user.id, supabase);

    if (!template) {
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json(template, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating email template:', error);

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

    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
