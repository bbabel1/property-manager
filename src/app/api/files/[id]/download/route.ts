import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client';
import { buildiumFetch } from '@/lib/buildium-http';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(request);
    const supabase = await getSupabaseServerClient();
    const fileId = (await params).id;

    if (!fileId) {
      return NextResponse.json({ error: 'Missing file id' }, { status: 400 });
    }

    // Access check via RLS
    const { data: file, error: fileErr } = await supabase
      .from('files')
      .select('id, storage_provider, bucket, storage_key, file_name, mime_type, buildium_file_id, org_id')
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

    if (file.storage_provider === 'supabase') {
      if (!hasSupabaseAdmin()) {
        return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 });
      }
      const admin = requireSupabaseAdmin('files download');

      if (!file.bucket || !file.storage_key) {
        return NextResponse.json({ error: 'File missing storage path' }, { status: 400 });
      }

      // Get presigned URL for download
      const expiresIn = 5 * 60; // 5 minutes
      const { data: signData, error: signErr } = await admin.storage
        .from(String(file.bucket))
        .createSignedUrl(String(file.storage_key), expiresIn, { download: true });

      if (signErr) {
        return NextResponse.json(
          { error: 'Failed to create download URL', details: signErr.message },
          { status: 500 },
        );
      }

      // Redirect to presigned URL
      return NextResponse.redirect(signData.signedUrl);
    }

    if (file.storage_provider === 'buildium' || file.buildium_file_id) {
      // For Buildium files, get download URL
      const buildiumFileId = file.buildium_file_id;
      if (!buildiumFileId) {
        return NextResponse.json({ error: 'Missing Buildium file ID' }, { status: 400 });
      }

      const orgId = (file as { org_id?: string | null })?.org_id ?? undefined;
      const res = await buildiumFetch('POST', `/files/${buildiumFileId}/download`, undefined, undefined, orgId);

      if (!res.ok) {
        return NextResponse.json(
          { error: 'Buildium download URL failed', status: res.status },
          { status: 502 },
        );
      }

      const json = res.json as { DownloadUrl?: string } | null;
      if (json?.DownloadUrl) {
        return NextResponse.redirect(json.DownloadUrl);
      }

      return NextResponse.json({ error: 'Buildium did not return download URL' }, { status: 502 });
    }

    return NextResponse.json({ error: 'Unsupported storage provider' }, { status: 400 });
  } catch (error) {
    console.error('Error in file download:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
