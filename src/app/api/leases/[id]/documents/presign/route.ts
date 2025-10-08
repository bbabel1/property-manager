import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB
const BUCKET = 'lease-documents'

function extFromMime(mime: string) {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg') return 'jpg'
  return 'bin'
}

export async function POST(request: NextRequest, { params }: { params: { leaseId: string } }) {
  const corr = request.headers.get('Idempotency-Key') || `presign:${Date.now()}:${Math.random()}`
  try {
    if (!hasSupabaseAdmin()) return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 })
    const supabaseAdmin = requireSupabaseAdmin('lease documents presign')
    const supabase = await getSupabaseServerClient()
    const leaseIdNum = Number(params.leaseId)
    if (!leaseIdNum) return NextResponse.json({ error: 'Invalid leaseId' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const { fileName, mimeType, sizeBytes, sha256 } = body || {}
    if (!mimeType || !ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json({ error: 'Unsupported content-type' }, { status: 400 })
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 })
    }

    // Check existence with admin, then membership with user client for 403/404 fidelity
    const { data: leaseAdmin } = await supabaseAdmin.from('lease').select('id, org_id').eq('id', leaseIdNum).maybeSingle()
    const { data: lease } = await supabase.from('lease').select('id, org_id').eq('id', leaseIdNum).maybeSingle()
    if (!lease && leaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!leaseAdmin) return NextResponse.json({ error: 'Lease not found' }, { status: 404 })

    const ext = extFromMime(mimeType)
    const rand = randomUUID()
    const safeName = typeof fileName === 'string' && fileName.length > 0 ? fileName.replace(/[^A-Za-z0-9._-]+/g, '_') : `${rand}.${ext}`
    const storage_path = `org/${lease?.org_id}/leases/${lease?.id}/${rand}-${safeName}`

    const expiresIn = 15 * 60 // 15 min
    const { data: signData, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storage_path)
    if (signErr) return NextResponse.json({ error: 'Failed to presign', details: signErr.message }, { status: 500 })

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    const payload = { putUrl: signData.signedUrl, storage_path, expiresAt }

    // Log with correlation id for observability
    try { logger.info({ correlation_id: corr, lease_id: leaseIdNum, storage_path, mimeType, sizeBytes, sha256 }, 'Presign lease document issued') } catch {}

    return NextResponse.json(payload, { status: 200 })
  } catch (e: any) {
    try { logger.error({ correlation_id: corr, error: e?.message || e }, 'Presign lease document failed') } catch {}
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
