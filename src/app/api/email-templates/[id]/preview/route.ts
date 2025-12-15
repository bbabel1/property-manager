/**
 * Email Template Preview API Route
 *
 * POST /api/email-templates/[id]/preview - Preview rendered template with sample or custom variables
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { getEmailTemplate, renderEmailTemplate } from '@/lib/email-template-service';
import {
  TemplateRenderSchema,
  type TemplateVariableValues,
  type EmailTemplateKey,
  type EmailTemplate,
  type EmailTemplateStatus,
} from '@/types/email-templates';
import { supabaseAdmin } from '@/lib/db';
import { getAvailableVariables } from '@/lib/email-templates/variable-definitions';

// Simple in-memory rate limiting (10 requests per minute per user)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }

  if (userLimit.count >= 10) {
    return false;
  }

  userLimit.count++;
  return true;
}

/**
 * POST /api/email-templates/[id]/preview
 * Preview rendered template
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);
    const { id } = await params;

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Maximum 10 previews per minute.',
          },
        },
        { status: 429 },
      );
    }

    // Fetch template
    const { data: templateData, error } = await supabaseAdmin
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !templateData) {
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

    const availableVariables = Array.isArray(templateData.available_variables)
      ? templateData.available_variables
      : JSON.parse(JSON.stringify(templateData.available_variables || []));

    const status =
      templateData.status === 'active' ||
      templateData.status === 'inactive' ||
      templateData.status === 'archived'
        ? (templateData.status as EmailTemplateStatus)
        : 'active';

    const template: EmailTemplate = {
      ...templateData,
      available_variables: availableVariables,
      status,
    };

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const validated = TemplateRenderSchema.parse(body);

    // Build variable values (merge with defaults from variable definitions)
    const templateKey = template.template_key as EmailTemplateKey;
    const variableDefs = getAvailableVariables(templateKey);
    const variableValues: TemplateVariableValues = {};

    // Set defaults from variable definitions
    for (const varDef of variableDefs) {
      variableValues[varDef.key] = varDef.example || varDef.nullDefault;
    }

    // Override with provided variables
    if (validated.variables) {
      Object.assign(variableValues, validated.variables as TemplateVariableValues);
    }

    // Render template
    const result = await renderEmailTemplate(template, variableValues);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error previewing email template:', error);

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

    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'ORG_FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden: organization access denied' }, { status: 403 });
    }

    return NextResponse.json({ error: 'Failed to preview template' }, { status: 500 });
  }
}
