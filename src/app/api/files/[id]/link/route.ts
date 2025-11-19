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
    const normalizedBillId =
      typeof entityId === 'number'
        ? String(entityId)
        : typeof entityId === 'string'
          ? entityId.trim()
          : '';
    if (!normalizedBillId) {
      return NextResponse.json({ error: 'Invalid bill identifier' }, { status: 400 });
    }

    const { data: file, error: fileErr } = await admin
      .from('files')
      .select('id, storage_provider, bucket, storage_key')
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

    const billPrefix = `bill/${normalizedBillId}/`;
    if (!file.storage_key || !file.storage_key.startsWith(billPrefix)) {
      return NextResponse.json(
        { error: 'File is not associated with the specified bill' },
        { status: 400 },
      );
    }

    const deletedAt = new Date().toISOString();
    const { error: updateErr } = await admin
      .from('files')
      .update({ deleted_at: deletedAt })
      .eq('id', fileId);

    if (updateErr) {
      return NextResponse.json(
        { error: 'Unlink failed', details: updateErr.message },
        { status: 500 },
      );
    }

    if (file.storage_provider === 'supabase' && file.bucket && file.storage_key) {
      try {
        await admin.storage.from(file.bucket).remove([file.storage_key]);
      } catch (storageError) {
        console.error('Failed to remove bill attachment object', storageError);
      }
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
