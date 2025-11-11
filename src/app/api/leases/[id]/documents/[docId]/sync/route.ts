'use server';

import { NextRequest, NextResponse } from 'next/server';
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client';
import { requireUser } from '@/lib/auth';
import { uploadLeaseDocumentToBuildium } from '@/lib/buildium-file-sync';
import { logger } from '@/lib/logger';

/**
 * POST /api/leases/[id]/documents/[docId]/sync
 *
 * Resync a lease document to Buildium.
 * In the new schema, files are directly associated via entity_type='Lease' and entity_id=buildium_lease_id.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 });
  }

  try {
    await requireUser(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNAUTHENTICATED';
    logger.error(
      { error: message, leaseId: (await params).id },
      'Authentication failed in lease document sync',
    );
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const admin = requireSupabaseAdmin('lease document resync');

  const { id, docId } = await params;
  const leaseIdNum = Number(id);
  if (!Number.isFinite(leaseIdNum) || !docId) {
    return NextResponse.json({ error: 'Invalid lease or document id' }, { status: 400 });
  }

  // Get the lease to find its Buildium ID and org
  const { data: lease, error: leaseErr } = await admin
    .from('lease')
    .select('buildium_lease_id, org_id')
    .eq('id', leaseIdNum)
    .maybeSingle();

  if (leaseErr) {
    logger.error(
      { leaseId: leaseIdNum, fileId: docId, error: leaseErr.message },
      'Lease lookup failed',
    );
    return NextResponse.json({ error: 'Failed to locate lease' }, { status: 500 });
  }
  if (!lease) {
    return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
  }
  if (!lease.buildium_lease_id) {
    return NextResponse.json({ error: 'Lease not linked to Buildium' }, { status: 400 });
  }

  // Look up the file using entity_type and entity_id
  const { data: fileRow, error: fileErr } = await admin
    .from('files')
    .select(
      'id, storage_provider, bucket, storage_key, file_name, mime_type, buildium_file_id, buildium_href, description, buildium_category_id',
    )
    .eq('id', docId)
    .eq('org_id', lease.org_id)
    .eq('entity_type', 'Lease')
    .eq('entity_id', lease.buildium_lease_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fileErr) {
    logger.error(
      { leaseId: leaseIdNum, fileId: docId, error: fileErr.message },
      'Lease file lookup failed',
    );
    return NextResponse.json({ error: 'Failed to load file record' }, { status: 500 });
  }
  if (!fileRow) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  if (fileRow.storage_provider !== 'supabase') {
    return NextResponse.json(
      { error: 'Resync only supported for Supabase stored files' },
      { status: 422 },
    );
  }
  if (!fileRow.bucket || !fileRow.storage_key) {
    return NextResponse.json({ error: 'File missing storage location' }, { status: 422 });
  }

  // Download file from storage
  const { data: blob, error: downloadErr } = await admin.storage
    .from(String(fileRow.bucket))
    .download(String(fileRow.storage_key));
  if (downloadErr || !blob) {
    logger.error(
      { leaseId: leaseIdNum, fileId: docId, error: downloadErr?.message },
      'Failed to download lease file from storage',
    );
    return NextResponse.json({ error: 'Failed to download file from storage' }, { status: 500 });
  }

  const arrayBuffer = await blob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  // Get category name from buildium_category_id if available
  let category: string | null = null;
  if (fileRow.buildium_category_id) {
    const { data: categoryRecord } = await admin
      .from('file_categories')
      .select('category_name')
      .eq('buildium_category_id', fileRow.buildium_category_id)
      .eq('org_id', lease.org_id)
      .maybeSingle();
    category = categoryRecord?.category_name ?? null;
  }

  const syncResult = await uploadLeaseDocumentToBuildium({
    admin,
    leaseId: leaseIdNum,
    fileId: docId,
    fileName: fileRow.file_name,
    mimeType: fileRow.mime_type || undefined,
    base64,
    category,
    buildiumCategoryId: fileRow.buildium_category_id ?? null,
  });

  if (!syncResult) {
    return NextResponse.json(
      { skipped: true, reason: 'Lease is not linked to Buildium yet' },
      { status: 200 },
    );
  }

  if (syncResult.error) {
    return NextResponse.json({ error: syncResult.error }, { status: 502 });
  }

  const refreshedFile = syncResult.updatedFile ?? fileRow;
  const buildiumFileId =
    (typeof syncResult.buildiumFile?.Id === 'number' && Number.isFinite(syncResult.buildiumFile.Id)
      ? syncResult.buildiumFile.Id
      : null) ??
    (typeof refreshedFile?.buildium_file_id === 'number' ? refreshedFile.buildium_file_id : null);

  return NextResponse.json({
    file: refreshedFile,
    buildiumFile: syncResult.buildiumFile ?? null,
    buildiumFileId,
  });
}
