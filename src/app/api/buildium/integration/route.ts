/**
 * Buildium Integration Management API
 * 
 * GET /api/buildium/integration - Get integration status
 * PUT /api/buildium/integration - Update credentials
 * DELETE /api/buildium/integration - Delete integration
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { supabaseAdmin } from '@/lib/db';
import {
  _getOrgScopedBuildiumConfig,
  storeBuildiumCredentials,
  deleteBuildiumCredentials,
  _maskSecret,
  validateBuildiumBaseUrl,
  type BuildiumCredentials,
} from '@/lib/buildium/credentials-manager';

/**
 * Resolve orgId from request context
 */
async function resolveOrgId(request: NextRequest, userId: string): Promise<string> {
  // Check header first
  const headerOrgId = request.headers.get('x-org-id');
  if (headerOrgId) {
    return headerOrgId.trim();
  }

  // Check cookies
  const cookieOrgId = request.cookies.get('x-org-id')?.value;
  if (cookieOrgId) {
    return cookieOrgId.trim();
  }

  // Fallback to first org membership
  const { data: membership, error } = await supabaseAdmin
    .from('org_memberships')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !membership) {
    throw new Error('ORG_CONTEXT_REQUIRED');
  }

  return membership.org_id;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const orgId = await resolveOrgId(request, auth.user.id);

    // Get integration from DB
    const { data: integration, error } = await supabaseAdmin
      .from('buildium_integrations')
      .select('*')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: { code: 'DATABASE_ERROR', message: 'Failed to fetch integration' } },
        { status: 500 }
      );
    }

    if (!integration) {
      return NextResponse.json({
        is_enabled: false,
        has_credentials: false,
        last_tested_at: null,
        webhook_secret_rotated_at: null,
        base_url: null,
        masked_client_id: null,
        masked_client_secret: null,
        masked_webhook_secret: null,
      });
    }

    // Return masked secrets only (show that credentials exist without decrypting)
    // Extract a portion of the encrypted string for masking display
    const getMaskedFromEncrypted = (encrypted: string | null): string | null => {
      if (!encrypted) return null;
      // Encrypted format is salt:iv:tag:encrypted, extract last part
      const parts = encrypted.split(':');
      if (parts.length === 4 && parts[3]) {
        const encryptedPart = parts[3];
        // Show first 3 and last 3 chars of encrypted portion
        if (encryptedPart.length > 6) {
          return `${encryptedPart.substring(0, 3)}***${encryptedPart.substring(encryptedPart.length - 3)}`;
        }
        return '***';
      }
      return '***';
    };

    return NextResponse.json({
      is_enabled: integration.is_enabled,
      has_credentials: true,
      last_tested_at: integration.last_tested_at,
      webhook_secret_rotated_at: integration.webhook_secret_rotated_at,
      base_url: integration.base_url,
      masked_client_id: getMaskedFromEncrypted(integration.client_id_encrypted),
      masked_client_secret: getMaskedFromEncrypted(integration.client_secret_encrypted),
      masked_webhook_secret: getMaskedFromEncrypted(integration.webhook_secret_encrypted),
    });
  } catch (error) {
    console.error('Error fetching Buildium integration:', error);

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
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch Buildium integration' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const orgId = await resolveOrgId(request, auth.user.id);
    const body = await request.json();

    // Validate base_url if provided
    if (body.baseUrl && !validateBuildiumBaseUrl(body.baseUrl)) {
      return NextResponse.json(
        { error: { code: 'invalid_base_url', message: 'Invalid base_url: must be apisandbox.buildium.com or api.buildium.com' } },
        { status: 400 }
      );
    }

    // Prepare credentials object
    const credentials: BuildiumCredentials = {
      clientId: body.clientId || undefined,
      clientSecret: body.clientSecret || undefined,
      baseUrl: body.baseUrl || undefined,
      webhookSecret: body.webhookSecret || undefined,
      isEnabled: body.isEnabled,
      unchangedFields: body.unchangedFields || [],
    };

    // Validate that at least one field is being updated
    if (
      !credentials.clientId &&
      !credentials.clientSecret &&
      !credentials.baseUrl &&
      !credentials.webhookSecret &&
      credentials.isEnabled === undefined
    ) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'At least one field must be provided' } },
        { status: 400 }
      );
    }

    await storeBuildiumCredentials(orgId, credentials, auth.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating Buildium integration:', error);

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
      { error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Failed to update Buildium integration' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const orgId = await resolveOrgId(request, auth.user.id);

    await deleteBuildiumCredentials(orgId, auth.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Buildium integration:', error);

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
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to delete Buildium integration' } },
      { status: 500 }
    );
  }
}
