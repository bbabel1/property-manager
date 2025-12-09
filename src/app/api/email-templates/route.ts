/**
 * Email Templates API Routes
 *
 * GET /api/email-templates - List templates with pagination and filtering
 * POST /api/email-templates - Create new template
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { getAllEmailTemplates, createEmailTemplate } from '@/lib/email-template-service';
import { EmailTemplateInsertSchema } from '@/types/email-templates';
import { supabaseAdmin } from '@/lib/db';

/**
 * GET /api/email-templates
 * List email templates with pagination and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);

    const url = new URL(request.url);
    const status = url.searchParams.get('status') as 'active' | 'inactive' | 'archived' | null;
    const templateKey = url.searchParams.get('templateKey');
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);

    const filters: { status?: 'active' | 'inactive' | 'archived' } = {};
    if (status && ['active', 'inactive', 'archived'].includes(status)) {
      filters.status = status;
    }

    const templates = await getAllEmailTemplates(orgId, filters.status ? filters : undefined);

    // Filter by template_key if provided
    let filteredTemplates = templates;
    if (templateKey) {
      filteredTemplates = templates.filter((t) => t.template_key === templateKey);
    }

    // Pagination
    const offset = (page - 1) * limit;
    const paginatedTemplates = filteredTemplates.slice(offset, offset + limit);
    const total = filteredTemplates.length;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      templates: paginatedTemplates,
      pagination: {
        page,
        limit,
        total,
        totalPages,
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
    const user = await requireUser(request);
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);

    // Check user role (org_admin or org_manager required)
    const { data: membership } = await supabaseAdmin
      .from('org_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single();

    if (!membership || !['org_admin', 'org_manager', 'platform_admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin or Manager role required' }, { status: 403 });
    }

    const body = await request.json();
    const validated = EmailTemplateInsertSchema.parse({
      ...body,
      org_id: orgId,
    });

    // Check if template_key already exists for this org
    const existing = await supabaseAdmin
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

    const template = await createEmailTemplate(orgId, validated, user.id);

    if (!template) {
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    console.error('Error creating email template:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: error.errors,
          },
        },
        { status: 400 },
      );
    }

    if (error.message?.includes('Invalid variables')) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_VARIABLES',
            message: error.message,
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
