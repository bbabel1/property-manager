import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest, { params }: { params: { leaseId: string, docId: string } }) {
  const corr = request.headers.get('Idempotency-Key') || `presign-get:${Date.now()}:${Math.random()}`
  try {
    if (!hasSupabaseAdmin()) return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 })
    const supabaseAdmin = requireSupabaseAdmin('lease documents presign get')
    const supabase = await getSupabaseServerClient()
    const leaseIdNum = Number(params.leaseId)
    const fileId = params.docId
    if (!leaseIdNum || !fileId) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

    // Validate link exists and fetch file metadata
    const { data: link, error: linkErr } = await supabaseAdmin
      .from('file_links')
      .select('id, file_id, entity_type, entity_int, org_id')
      .eq('entity_type', 'lease')
      .eq('entity_int', leaseIdNum)
      .eq('file_id', fileId)
      .maybeSingle()
    if (linkErr) return NextResponse.json({ error: 'Lookup failed', details: linkErr.message }, { status: 500 })
    if (!link) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const { data: file, error: fileErr } = await supabaseAdmin
      .from('files')
      .select('id, storage_provider, bucket, storage_key, external_url, sha256')
      .eq('id', fileId)
      .maybeSingle()
    if (fileErr) return NextResponse.json({ error: 'File lookup failed', details: fileErr.message }, { status: 500 })
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 })

    // Supabase storage presign
    if (file.storage_provider === 'supabase' && file.bucket && file.storage_key) {
      const expiresIn = 15 * 60
      const { data: signData, error: signErr } = await supabaseAdmin.storage
        .from(String(file.bucket))
        .createSignedUrl(String(file.storage_key), expiresIn, { download: true })
      if (signErr) return NextResponse.json({ error: 'Failed to presign download', details: signErr.message }, { status: 500 })

      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
      const payload = { getUrl: signData.signedUrl, expiresAt, sha256: file.sha256 || null }

      try { logger.info({ correlation_id: corr, lease_id: leaseIdNum, file_id: fileId, storage_key: file.storage_key }, 'Presign lease document (GET)') } catch {}
      return NextResponse.json(payload, { status: 200 })
    }

    // Buildium file presign
    if (file.storage_provider === 'buildium') {
      const buildiumFileId = (await supabaseAdmin
        .from('files')
        .select('buildium_file_id')
        .eq('id', fileId)
        .maybeSingle()).data?.buildium_file_id
      if (!buildiumFileId) return NextResponse.json({ error: 'Missing Buildium file id' }, { status: 400 })

      const base = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1'
      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID || '',
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET || ''
      }
      const res = await fetch(`${base}/files/${buildiumFileId}/download`, { method: 'POST', headers })
      if (!res.ok) return NextResponse.json({ error: 'Buildium download URL failed', status: res.status }, { status: 502 })
      const json = await res.json()
      return NextResponse.json({ getUrl: json?.DownloadUrl, expiresAt: json?.ExpirationDateTime || null }, { status: 200 })
    }

    return NextResponse.json({ error: 'Presign not supported for this storage provider' }, { status: 501 })
  } catch (e: any) {
    try { logger.error({ correlation_id: corr, error: e?.message || e }, 'Presign lease document (GET) failed') } catch {}
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
