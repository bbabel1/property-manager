
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client';
import { logger } from '@/lib/logger';

/**
 * GET /api/leases/[id]/documents/[docId]/presign
 *
 * Get a presigned URL for a lease document.
 * In the new schema, files are directly associated via entity_type='Lease' and entity_id=buildium_lease_id.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const corr =
    request.headers.get('Idempotency-Key') || `presign-get:${Date.now()}:${Math.random()}`;
  try {
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 });
    }
    const supabaseAdmin = requireSupabaseAdmin('lease documents presign get');
    const { id, docId } = await params;
    const leaseIdNum = Number(id);
    const fileId = docId;
    if (!leaseIdNum || !fileId) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // Get the lease to find its Buildium ID
    const { data: lease, error: leaseErr } = await supabaseAdmin
      .from('lease')
      .select('buildium_lease_id, org_id')
      .eq('id', leaseIdNum)
      .maybeSingle();

    if (leaseErr) {
      return NextResponse.json(
        { error: 'Lease lookup failed', details: leaseErr.message },
        { status: 500 },
      );
    }
    if (!lease) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }

    const buildiumLeaseId =
      typeof lease.buildium_lease_id === 'number'
        ? lease.buildium_lease_id
        : Number(lease.buildium_lease_id);
    const orgId = typeof lease.org_id === 'string' ? lease.org_id : null;

    if (!orgId) {
      return NextResponse.json({ error: 'Lease organization missing' }, { status: 400 });
    }

    if (!Number.isFinite(buildiumLeaseId)) {
      return NextResponse.json({ error: 'Lease not linked to Buildium' }, { status: 400 });
    }

    // Look up the file directly using entity_type and entity_id
    const { data: file, error: fileErr } = await supabaseAdmin
      .from('files')
      .select('id, storage_provider, bucket, storage_key, external_url, sha256, buildium_file_id')
      .eq('id', fileId)
      .eq('org_id', orgId)
      .eq('entity_type', 'Leases')
      .eq('entity_id', buildiumLeaseId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fileErr) {
      return NextResponse.json(
        { error: 'File lookup failed', details: fileErr.message },
        { status: 500 },
      );
    }
    if (!file) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Supabase storage presign
    if (file.storage_provider === 'supabase' && file.bucket && file.storage_key) {
      const expiresIn = 15 * 60;
      const { data: signData, error: signErr } = await supabaseAdmin.storage
        .from(String(file.bucket))
        .createSignedUrl(String(file.storage_key), expiresIn, { download: true });
      if (signErr) {
        return NextResponse.json(
          { error: 'Failed to presign download', details: signErr.message },
          { status: 500 },
        );
      }

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      const payload = { getUrl: signData.signedUrl, expiresAt, sha256: file.sha256 || null };

      try {
        logger.info(
          {
            correlation_id: corr,
            lease_id: leaseIdNum,
            file_id: fileId,
            storage_key: file.storage_key,
          },
          'Presign lease document (GET)',
        );
      } catch {}
      return NextResponse.json(payload, { status: 200 });
    }

    // Buildium file presign
    if (file.storage_provider === 'buildium') {
      const buildiumFileId = file.buildium_file_id;
      if (!buildiumFileId) {
        return NextResponse.json({ error: 'Missing Buildium file id' }, { status: 400 });
      }

      const base = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1';
      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID || '',
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET || '',
      };
      const res = await fetch(`${base}/files/${buildiumFileId}/download`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: 'Buildium download URL failed', status: res.status },
          { status: 502 },
        );
      }
      const json = await res.json();
      return NextResponse.json(
        { getUrl: json?.DownloadUrl, expiresAt: json?.ExpirationDateTime || null },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { error: 'Presign not supported for this storage provider' },
      { status: 501 },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    try {
      logger.error(
        { correlation_id: corr, error: message },
        'Presign lease document (GET) failed',
      );
    } catch {}
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
