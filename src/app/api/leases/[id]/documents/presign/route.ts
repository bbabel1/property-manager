import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { logger } from '@/lib/logger'
import { randomUUID } from 'crypto'
import type { Database } from '@/types/database'
import { requireAuth } from '@/lib/auth/guards'
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id'
import { requireOrgMember } from '@/lib/auth/org-guards'

const ALLOWED_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB
const BUCKET = 'lease-documents'

type LeaseRow = Database['public']['Tables']['lease']['Row']
type PropertyRow = Database['public']['Tables']['properties']['Row']

function extFromMime(mime: string) {
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg') return 'jpg'
  return 'bin'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const corr = request.headers.get('Idempotency-Key') || `presign:${Date.now()}:${Math.random()}`
  try {
    const { supabase, user } = await requireAuth()
    const orgId = await resolveOrgIdFromRequest(request, user.id, supabase)
    await requireOrgMember({ client: supabase, userId: user.id, orgId })
    if (!hasSupabaseAdmin()) return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 })
    const supabaseAdmin = requireSupabaseAdmin('lease documents presign')
    const supabaseServer = await getSupabaseServerClient()
    const { id } = await params
    const leaseIdNum = Number(id)
    if (!leaseIdNum) return NextResponse.json({ error: 'Invalid leaseId' }, { status: 400 })

    const body = (await request.json().catch(() => ({}))) as Partial<{
      fileName: string
      mimeType: string
      sizeBytes: number
      sha256: string
    }>
    const { fileName, mimeType, sizeBytes, sha256 } = body || {}
    if (!mimeType || !ALLOWED_TYPES.has(mimeType)) {
      return NextResponse.json({ error: 'Unsupported content-type' }, { status: 400 })
    }
    const normalizedSize = typeof sizeBytes === 'number' ? sizeBytes : Number(sizeBytes)
    if (!Number.isFinite(normalizedSize) || normalizedSize <= 0) {
      return NextResponse.json({ error: 'Invalid file size' }, { status: 400 })
    }
    if (normalizedSize > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 })
    }

    // Check existence with admin, then membership with user client for 403/404 fidelity
    const { data: leaseAdmin } = await supabaseAdmin
      .from('lease')
      .select('id, org_id, property_id')
      .eq('id', leaseIdNum)
      .eq('org_id', orgId)
      .maybeSingle<Pick<LeaseRow, 'id' | 'org_id' | 'property_id'>>()
    const { data: lease } = await supabaseServer
      .from('lease')
      .select('id, org_id, property_id')
      .eq('id', leaseIdNum)
      .eq('org_id', orgId)
      .maybeSingle<Pick<LeaseRow, 'id' | 'org_id' | 'property_id'>>()
    if (!lease && leaseAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!leaseAdmin) return NextResponse.json({ error: 'Lease not found' }, { status: 404 })
    if (!leaseAdmin.org_id) return NextResponse.json({ error: 'Lease missing organization' }, { status: 400 })
    if (leaseAdmin.org_id !== orgId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!leaseAdmin.property_id) return NextResponse.json({ error: 'Lease missing property' }, { status: 400 })

    const { data: propertyRow, error: propertyError } = await supabaseAdmin
      .from('properties')
      .select('id, org_id')
      .eq('id', leaseAdmin.property_id)
      .eq('org_id', orgId)
      .maybeSingle<Pick<PropertyRow, 'id' | 'org_id'>>()
    if (propertyError) {
      return NextResponse.json({ error: 'Failed to load property' }, { status: 500 })
    }
    if (!propertyRow) return NextResponse.json({ error: 'Property not found' }, { status: 404 })
    if (!propertyRow.org_id) return NextResponse.json({ error: 'Property missing organization' }, { status: 400 })

    const ext = extFromMime(mimeType)
    const rand = randomUUID()
    const safeName = typeof fileName === 'string' && fileName.length > 0 ? fileName.replace(/[^A-Za-z0-9._-]+/g, '_') : `${rand}.${ext}`
    const storageOrgId = lease?.org_id ?? propertyRow.org_id
    const storage_path = `org/${storageOrgId}/leases/${lease?.id}/${rand}-${safeName}`

    const expiresIn = 15 * 60 // 15 min
    const { data: signData, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storage_path)
    if (signErr) return NextResponse.json({ error: 'Failed to presign', details: signErr.message }, { status: 500 })

    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    const payload = { putUrl: signData.signedUrl, storage_path, expiresAt }

    // Log with correlation id for observability
    try {
      logger.info(
        { correlation_id: corr, lease_id: leaseIdNum, storage_path, mimeType, sizeBytes: normalizedSize, sha256 },
        'Presign lease document issued'
      )
    } catch {}

    return NextResponse.json(payload, { status: 200 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    try { logger.error({ correlation_id: corr, error: message }, 'Presign lease document failed') } catch {}
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
