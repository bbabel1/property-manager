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
    entityId?: number | string;
  };

  if (!entityType || entityId === undefined || entityId === null) {
    return NextResponse.json({ error: 'Missing entityType or entityId' }, { status: 400 });
  }

  const fileId = (await params).id;
  const normalizedRequestType = entityType.toLowerCase();

  if (normalizedRequestType === 'bill') {
    const clauses: string[] = [];
    if (typeof entityId === 'string') {
      const trimmed = entityId.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        clauses.push(`entity_uuid.eq.${trimmed}`);
      }
    } else if (typeof entityId === 'number' && Number.isFinite(entityId)) {
      clauses.push(`entity_int.eq.${entityId}`);
    }

    if (!clauses.length) {
      return NextResponse.json({ error: 'Invalid bill identifier' }, { status: 400 });
    }

    const { error: deleteError } = await admin
      .from('file_links')
      .delete()
      .eq('file_id', fileId)
      .eq('entity_type', 'bill')
      .or(clauses.join(','));

    if (deleteError) {
      return NextResponse.json(
        { error: 'Unlink failed', details: deleteError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  }

  const normalizedEntityType = normalizeEntityType(entityType);
  if (!normalizedEntityType) {
    return NextResponse.json({ error: `Unsupported entityType "${entityType}"` }, { status: 400 });
  }

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

  if (file.entity_type !== normalizedEntityType || file.entity_id !== entityId) {
    return NextResponse.json(
      { error: 'File is not associated with the specified entity' },
      { status: 400 },
    );
  }

  const { error: updateErr } = await admin
    .from('files')
    .update({
      entity_type: FILE_ENTITY_TYPES.PROPERTIES,
      entity_id: 0,
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
