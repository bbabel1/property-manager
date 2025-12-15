/**
 * Draft Email Template Preview API Route
 *
 * POST /api/email-templates/preview - Preview unsaved templates with sample/default variables
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { getAvailableVariables } from '@/lib/email-templates/variable-definitions';
import {
  EmailTemplateKeySchema,
  EmailTemplateVariableSchema,
  TemplateRenderSchema,
  type EmailTemplate,
  type TemplateVariableValues,
} from '@/types/email-templates';
import { sanitizeEmailTemplateHtml } from '@/lib/email-templates/sanitization';
import { renderEmailTemplate } from '@/lib/email-template-service';
import { supabaseAdmin } from '@/lib/db';

const DraftPreviewSchema = z.object({
  template_key: EmailTemplateKeySchema,
  name: z.string().min(1).max(255).optional(),
  subject_template: z.string().min(1).max(500),
  body_html_template: z.string().min(1).max(50000),
  body_text_template: z.string().max(50000).nullable().optional(),
  available_variables: z.array(EmailTemplateVariableSchema).optional(),
  variables: TemplateRenderSchema.shape.variables.optional(),
});

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

  userLimit.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);

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

    const body = await request.json();
    const validated = DraftPreviewSchema.parse(body);

    const availableVariables =
      validated.available_variables ?? getAvailableVariables(validated.template_key);

    // Build template-like object for rendering
    const sanitizedHtml = await sanitizeEmailTemplateHtml(validated.body_html_template);

    const template: EmailTemplate = {
      id: 'preview',
      org_id: orgId,
      template_key: validated.template_key,
      name: validated.name || 'Preview',
      description: null,
      subject_template: validated.subject_template,
      body_html_template: sanitizedHtml,
      body_text_template: validated.body_text_template ?? null,
      available_variables: availableVariables,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by_user_id: user.id,
      updated_by_user_id: user.id,
    };

    // Build variable values with defaults then merge provided overrides
    const variableValues: TemplateVariableValues = {};
    for (const varDef of availableVariables) {
      variableValues[varDef.key] = varDef.example || varDef.nullDefault;
    }
    if (validated.variables) {
      Object.assign(variableValues, validated.variables as TemplateVariableValues);
    }

    const result = await renderEmailTemplate(template, variableValues);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error previewing draft email template:', error);

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
