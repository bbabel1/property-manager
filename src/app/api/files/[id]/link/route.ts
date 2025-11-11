import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireSupabaseAdmin, hasSupabaseAdmin } from '@/lib/supabase-client';
import { FILE_ENTITY_TYPES, normalizeEntityType } from '@/lib/files';

/**
 * DELETE /api/files/[id]/link
 *
 * Updates a file's entity association to remove the link (set entity_type/entity_id to null/0).
 * Note: In the new schema, files are directly associated with entities via entity_type/entity_id.
 * This endpoint updates those fields to effectively "unlink" the file.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 });
  }
  const supabase = await getSupabaseServerClient();
  const admin = requireSupabaseAdmin('files unlink');

  const body = await request.json().catch(() => null);
  const { entityType, entityId } = (body || {}) as {
    entityType?: string;
    entityId?: number;
  };

  if (!entityType || entityId == null) {
    return NextResponse.json({ error: 'Missing entityType or entityId' }, { status: 400 });
  }

  const normalizedEntityType = normalizeEntityType(entityType);
  if (!normalizedEntityType) {
    return NextResponse.json({ error: `Unsupported entityType "${entityType}"` }, { status: 400 });
  }

  const fileId = (await params).id;

  // Verify the file exists and matches the entity
  const { data: file, error: fileErr } = await admin
    .from('files')
    .select('id, entity_type, entity_id')
    .eq('id', fileId)
    .is('deleted_at', null)
    .maybeSingle();

  if (fileErr) {
    return NextResponse.json(
      { error: 'File lookup failed', details: fileErr.message },
      { status: 500 },
    );
  }
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Verify the file is associated with the specified entity
  if (file.entity_type !== normalizedEntityType || file.entity_id !== entityId) {
    return NextResponse.json(
      { error: 'File is not associated with the specified entity' },
      { status: 400 },
    );
  }

  // Update file to remove entity association (set to a default/null state)
  // Note: Since entity_type and entity_id are NOT NULL in new schema,
  // we need to decide on the approach. For now, we'll require explicit entity to match
  // In practice, you might want to soft-delete or move to a "unlinked" category
  const { error: updateErr } = await admin
    .from('files')
    .update({
      entity_type: FILE_ENTITY_TYPES.PROPERTIES,
      entity_id: 0, // Default unlinked ID
      updated_at: new Date().toISOString(),
    })
    .eq('id', fileId);

  if (updateErr) {
    return NextResponse.json(
      { error: 'Unlink failed', details: updateErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
