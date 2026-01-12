/**
 * Buildium Integration Webhook Secret Rotation API
 * 
 * POST /api/buildium/integration/rotate-webhook-secret - Rotate webhook secret
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabase } from '@/lib/db';
import { rotateWebhookSecret } from '@/lib/buildium/credentials-manager';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { requireOrgMember } from '@/lib/auth/org-guards';

export async function POST(request: NextRequest) {
  try {
    const { supabase: client, user } = await requireAuth();
    const orgId = await resolveOrgIdFromRequest(request, user.id, client);
    await requireOrgMember({ client, userId: user.id, orgId });
    const body = await request.json();

    if (!body.webhookSecret || typeof body.webhookSecret !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'webhookSecret is required' } },
        { status: 400 }
      );
    }

    await rotateWebhookSecret(orgId, body.webhookSecret, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error rotating webhook secret:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === 'ORG_CONTEXT_REQUIRED') {
      return NextResponse.json(
        { error: { code: 'missing_org', message: 'Organization context required' } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to rotate webhook secret' } },
      { status: 500 }
    );
  }
}
