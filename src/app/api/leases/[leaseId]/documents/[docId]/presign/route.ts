import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'

const BUCKET = 'lease-documents'

export async function GET(request: NextRequest, { params }: { params: { leaseId: string, docId: string } }) {
  const corr = request.headers.get('Idempotency-Key') || `presign-get:${Date.now()}:${Math.random()}`
  try {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 })
    const supabase = await getSupabaseServerClient()
    const leaseIdNum = Number(params.leaseId)
    const docId = params.docId
    if (!leaseIdNum || !docId) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })

    // Fetch document via both admin and user to distinguish 403 vs 404
    const { data: docAdmin } = await supabaseAdmin!.from('lease_documents').select('id, lease_id, storage_path, mime_type, sha256').eq('id', docId).eq('lease_id', leaseIdNum).maybeSingle()
    const { data: doc } = await supabase
      .from('lease_documents')
      .select('id, lease_id, storage_path, mime_type, sha256')
      .eq('id', docId)
      .eq('lease_id', leaseIdNum)
      .maybeSingle()
    if (!doc && docAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!docAdmin) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const expiresIn = 15 * 60
    const { data: signData, error: signErr } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(doc.storage_path, expiresIn, { download: true })
    if (signErr) return NextResponse.json({ error: 'Failed to presign download', details: signErr.message }, { status: 500 })

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    const payload = { getUrl: signData.signedUrl, expiresAt, sha256: doc.sha256 || null }

    try { logger.info({ correlation_id: corr, lease_id: leaseIdNum, doc_id: docId, storage_path: doc.storage_path }, 'Presign lease document (GET)') } catch {}
    return NextResponse.json(payload, { status: 200 })
  } catch (e: any) {
    try { logger.error({ correlation_id: corr, error: e?.message || e }, 'Presign lease document (GET) failed') } catch {}
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
