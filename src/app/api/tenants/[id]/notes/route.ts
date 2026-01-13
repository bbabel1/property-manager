import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { requireOrgAdmin, resolveResourceOrg } from '@/lib/auth/org-guards';
import { buildiumFetch } from '@/lib/buildium-http';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rate = await checkRateLimit(request);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Missing tenant id' }, { status: 400 });
    }

    // Resolve org and enforce admin-level access for writes
    const resolvedOrg = await resolveResourceOrg(auth.supabase, 'tenant', id);
    if (!resolvedOrg.ok) {
      return NextResponse.json({ error: resolvedOrg.error }, { status: 404 });
    }

    await requireOrgAdmin({
      client: auth.supabase,
      userId: auth.user.id,
      orgId: resolvedOrg.orgId,
      ...(auth.orgRoles ? { orgRoles: auth.orgRoles } : {}),
      ...(auth.roles ? { roles: auth.roles } : {}),
      ...(supabaseAdmin ? { adminClient: supabaseAdmin } : {}),
    });

    // Get the tenant to retrieve buildium_tenant_id
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, buildium_tenant_id')
      .eq('id', id)
      .eq('org_id', resolvedOrg.orgId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    if (!tenant.buildium_tenant_id) {
      return NextResponse.json(
        { error: 'Tenant does not have a Buildium tenant ID. Cannot sync note to Buildium.' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const noteText = body.note?.trim() || '';
    
    if (!noteText) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 });
    }

    // Resolve orgId for Buildium API call
    let orgId: string | undefined;
    try {
      orgId = await resolveOrgIdFromRequest(request, auth.user.id);
    } catch (error) {
      logger.warn({ userId: auth.user.id, error }, 'Could not resolve orgId for Buildium API call');
      // Use resolvedOrg.orgId as fallback
      orgId = resolvedOrg.orgId || undefined;
    }

    // Map local note to Buildium format
    // Buildium requires Subject and Note fields
    // For now, we'll use a default subject and put the note content in the Note field
    // TODO: Consider allowing subject to be specified in the UI
    const buildiumPayload = {
      Subject: 'Tenant Note', // Default subject - could be made configurable
      Note: noteText,
      IsPrivate: Boolean(body.is_private),
    };

    let buildiumNote: any = null;
    let buildiumSyncError: string | null = null;

    // Try to create note in Buildium
    try {
      logger.info(
        { 
          tenantId: id, 
          buildiumTenantId: tenant.buildium_tenant_id,
          orgId 
        }, 
        'Creating tenant note in Buildium'
      );

      const response = await buildiumFetch(
        'POST',
        `/leases/tenants/${tenant.buildium_tenant_id}/notes`,
        undefined,
        buildiumPayload,
        orgId
      );

      if (!response.ok) {
        const errorData = response.json ?? {};
        buildiumSyncError = `Buildium API error: ${response.status} ${response.statusText}`;
        logger.error(
          { 
            tenantId: id, 
            buildiumTenantId: tenant.buildium_tenant_id,
            status: response.status,
            error: errorData 
          },
          'Failed to create tenant note in Buildium'
        );
      } else {
        buildiumNote = response.json ?? {};
        logger.info(
          { tenantId: id, buildiumTenantId: tenant.buildium_tenant_id },
          'Tenant note created successfully in Buildium'
        );
      }
    } catch (error) {
      buildiumSyncError = error instanceof Error ? error.message : 'Unknown error creating note in Buildium';
      logger.error({ tenantId: id, error }, 'Exception creating tenant note in Buildium');
    }

    // Save note locally regardless of Buildium sync status
    const now = new Date().toISOString();
    const { data: localNote, error: insertError } = await supabaseAdmin
      .from('tenant_notes')
      .insert({
        tenant_id: id,
        note: noteText,
        subject: buildiumPayload.Subject,
        created_at: now,
        updated_at: now,
        // Store Buildium note ID and metadata if sync was successful
        buildium_note_id: buildiumNote?.Id ? Number(buildiumNote.Id) : null,
        buildium_tenant_id: tenant.buildium_tenant_id,
        buildium_created_at: buildiumNote?.CreatedDateTime || null,
        buildium_updated_at: buildiumNote?.LastUpdatedDateTime || null,
      })
      .select('*')
      .single();

    if (insertError) {
      logger.error({ tenantId: id, error: insertError }, 'Failed to save tenant note locally');
      return NextResponse.json(
        { error: 'Failed to save note', buildium_sync_error: buildiumSyncError || undefined },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: localNote,
        buildium_note: buildiumNote || undefined,
        buildium_sync_error: buildiumSyncError || undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    logger.error({ error }, 'Error creating tenant note');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
