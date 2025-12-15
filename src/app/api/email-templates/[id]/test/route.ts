/**
 * Email Template Test API Route
 *
 * POST /api/email-templates/[id]/test - Send test email with rendered template
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { getEmailTemplate, renderEmailTemplate } from '@/lib/email-template-service';
import {
  TemplateRenderSchema,
  type EmailTemplateKey,
  type TemplateVariableValues,
  type EmailTemplate,
  type EmailTemplateStatus,
} from '@/types/email-templates';
import { supabaseAdmin } from '@/lib/db';
import { getAvailableVariables } from '@/lib/email-templates/variable-definitions';
import { sendEmailViaGmail } from '@/lib/gmail/send-email';
import { getStaffGmailIntegration } from '@/lib/gmail/token-manager';
import { z } from 'zod';

const TestEmailSchema = TemplateRenderSchema.extend({
  to: z.string().email(),
});

// Simple in-memory rate limiting (5 requests per hour per user)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (userLimit.count >= 5) {
    return false;
  }

  userLimit.count++;
  return true;
}

/**
 * POST /api/email-templates/[id]/test
 * Send test email
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request);
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabaseAdmin);
    const { id } = await params;

    // Check user role (admin/manager required)
    const { data: membership } = await supabaseAdmin
      .from('org_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('org_id', orgId)
      .single();

    if (!membership || !['org_admin', 'org_manager', 'platform_admin'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden: Admin or Manager role required' }, { status: 403 });
    }

    // Rate limiting
    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Maximum 5 test emails per hour.',
          },
        },
        { status: 429 },
      );
    }

    // Check Gmail integration
    const gmailIntegration = await getStaffGmailIntegration(user.id, orgId);
    if (!gmailIntegration || !gmailIntegration.is_active) {
      return NextResponse.json(
        {
          error: {
            code: 'GMAIL_NOT_CONNECTED',
            message: 'Gmail integration not connected. Please connect your Gmail account in Settings > Integrations.',
          },
        },
        { status: 400 },
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
    const body = await request.json();
    const validated = TestEmailSchema.parse(body);

    // Build variable values
    const templateKey = template.template_key as EmailTemplateKey;
    const variableDefs = getAvailableVariables(templateKey);
    const variableValues: TemplateVariableValues = {};

    // Set defaults
    for (const varDef of variableDefs) {
      variableValues[varDef.key] = varDef.example || varDef.nullDefault;
    }

    // Override with provided variables
    if (validated.variables) {
      Object.assign(variableValues, validated.variables as TemplateVariableValues);
    }

    // Render template
    const rendered = await renderEmailTemplate(template, variableValues);

    // Send test email
    const emailResult = await sendEmailViaGmail(
      user.id,
      orgId,
      {
        to: [
          {
            email: validated.to,
            name: 'Test Recipient',
          },
        ],
        subject: rendered.subject,
        html: rendered.bodyHtml,
        text: rendered.bodyText || undefined,
        from: {
          email: gmailIntegration.email,
          name: process.env.COMPANY_NAME || 'Property Management',
        },
      }
    );

    if (!emailResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'EMAIL_SEND_FAILED',
            message: emailResult.error || 'Failed to send test email',
          },
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      messageId: emailResult.messageId,
    });
  } catch (error: any) {
    console.error('Error sending test email:', error);

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

    return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 });
  }
}
