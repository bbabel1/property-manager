import { NextResponse } from 'next/server'
import { hasSupabaseAdmin, requireSupabaseAdmin, SupabaseAdminUnavailableError } from '@/lib/supabase-client'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; fileId: string }> },
) {
  const { id: billId, fileId } = await context.params

  if (!billId || !fileId) {
    return NextResponse.json({ error: 'Missing identifiers' }, { status: 400 })
  }

  const isUuid = billId.includes('-')
  const entityColumn = isUuid ? 'entity_uuid' : 'entity_int'
  const linkValue = isUuid ? billId : Number(billId)
  if (!isUuid && Number.isNaN(linkValue)) {
    return NextResponse.json({ error: 'Invalid bill id' }, { status: 400 })
  }

  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 })
  }

  let admin
  try {
    admin = requireSupabaseAdmin('bill file presign')
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    throw error
  }

  const { data: link, error: linkErr } = await admin
    .from('file_links')
    .select('file_id')
    .eq('entity_type', 'bill')
    .eq(entityColumn, linkValue as any)
    .eq('file_id', fileId)
    .maybeSingle()

  if (linkErr) {
    console.error('[bill-file-presign] file_links error', { billId, fileId, error: linkErr })
    return NextResponse.json({ error: 'File lookup failed', details: linkErr.message }, { status: 500 })
  }
  if (!link) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: file, error: fileErr } = await admin
    .from('files')
    .select('storage_provider, bucket, storage_key, sha256, buildium_file_id')
    .eq('id', fileId)
    .maybeSingle()

  if (fileErr) {
    return NextResponse.json({ error: 'File lookup failed', details: fileErr.message }, { status: 500 })
  }
  if (!file) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (file.storage_provider === 'supabase') {
    if (!file.bucket || !file.storage_key) {
      return NextResponse.json({ error: 'File missing storage path' }, { status: 400 })
    }
    const expiresIn = 15 * 60
    const { data: signData, error: signErr } = await admin.storage
      .from(String(file.bucket))
      .createSignedUrl(String(file.storage_key), expiresIn, { download: false })
    if (signErr) {
      return NextResponse.json({ error: 'Failed to presign', details: signErr.message }, { status: 500 })
    }
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    return NextResponse.json({ getUrl: signData.signedUrl, expiresAt, sha256: file.sha256 || null })
  }

  if (file.storage_provider === 'buildium') {
    const id = file.buildium_file_id
    if (!id) {
      return NextResponse.json({ error: 'Missing Buildium file id' }, { status: 400 })
    }
    const base = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1'
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID || '',
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET || '',
    }
    const res = await fetch(`${base}/files/${id}/download`, { method: 'POST', headers })
    if (!res.ok) {
      return NextResponse.json({ error: 'Buildium download URL failed', status: res.status }, { status: 502 })
    }
    const json = await res.json().catch(() => ({}))
    return NextResponse.json({ getUrl: json?.DownloadUrl, expiresAt: json?.ExpirationDateTime || null })
  }

  return NextResponse.json({ error: 'Unsupported storage provider' }, { status: 400 })
}
