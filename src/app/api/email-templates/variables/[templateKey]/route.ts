/**
 * Email Template Variables API Route
 *
 * GET /api/email-templates/variables/[templateKey] - Get available variables for a template type
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAvailableVariables } from '@/lib/email-templates/variable-definitions';
import { EmailTemplateKeySchema } from '@/types/email-templates';

/**
 * GET /api/email-templates/variables/[templateKey]
 * Get available variables for a template type
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateKey: string }> },
) {
  try {
    const { templateKey } = await params;

    // Validate template key
    const validated = EmailTemplateKeySchema.safeParse(templateKey);
    if (!validated.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_TEMPLATE_KEY',
            message: `Invalid template key: ${templateKey}`,
          },
        },
        { status: 400 },
      );
    }

    const variables = getAvailableVariables(validated.data);

    return NextResponse.json({ variables });
  } catch (error) {
    console.error('Error fetching template variables:', error);
    return NextResponse.json({ error: 'Failed to fetch variables' }, { status: 500 });
  }
}

