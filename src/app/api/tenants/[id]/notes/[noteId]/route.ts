import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { requireOrgAdmin, resolveResourceOrg } from '@/lib/auth/org-guards';
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const rate = await checkRateLimit(request);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const auth = await requireAuth();
    const { id: tenantId, noteId } = await params;

    if (!tenantId || !noteId) {
      return NextResponse.json({ error: 'Missing tenant id or note id' }, { status: 400 });
    }

    const resolvedOrg = await resolveResourceOrg(auth.supabase, 'tenant', tenantId);
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

    const { data: note, error: noteError } = await supabaseAdmin
      .from('tenant_notes')
      .select('id, tenant_id, buildium_note_id, buildium_tenant_id')
      .eq('id', noteId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (noteError) {
      logger.error({ tenantId, noteId, error: noteError }, 'Failed to load tenant note');
      return NextResponse.json({ error: 'Failed to load note' }, { status: 500 });
    }

    if (!note) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('buildium_tenant_id')
      .eq('id', tenantId)
      .eq('org_id', resolvedOrg.orgId)
      .maybeSingle();

    if (tenantError) {
      logger.error({ tenantId, noteId, error: tenantError }, 'Failed to load tenant');
      return NextResponse.json({ error: 'Failed to load tenant' }, { status: 500 });
    }

    // Note: Buildium's API does not support DELETE for tenant notes.
    // The API only supports GET, POST, GET/{noteId}, and PUT operations.
    // We delete the note locally but cannot delete it from Buildium.

    const { error: deleteError } = await supabaseAdmin
      .from('tenant_notes')
      .delete()
      .eq('id', noteId)
      .eq('tenant_id', tenantId);

    if (deleteError) {
      logger.error({ tenantId, noteId, error: deleteError }, 'Failed to delete tenant note');
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    logger.error({ error }, 'Error deleting tenant note');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
