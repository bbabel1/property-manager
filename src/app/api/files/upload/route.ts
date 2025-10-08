import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'

type EntityType = 'property' | 'unit' | 'lease' | 'tenant' | 'owner' | 'vendor' | 'task' | 'task_history' | 'work_order' | 'bill' | 'contact'

async function resolveOrgForEntity(supabase: any, entityType: EntityType, entityId: string | number): Promise<string | null> {
  switch (entityType) {
    case 'property': {
      const { data } = await supabase.from('properties').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    case 'unit': {
      const { data } = await supabase
        .from('units')
        .select('property_id')
        .eq('id', entityId)
        .maybeSingle()
      if (!data?.property_id) return null
      const { data: p } = await supabase.from('properties').select('org_id').eq('id', data.property_id).maybeSingle()
      return p?.org_id ?? null
    }
    case 'lease': {
      const { data } = await supabase.from('lease').select('org_id, property_id').eq('id', entityId).maybeSingle()
      if (data?.org_id) return data.org_id
      if (!data?.property_id) return null
      const { data: p } = await supabase.from('properties').select('org_id').eq('id', data.property_id).maybeSingle()
      return p?.org_id ?? null
    }
    case 'tenant': {
      const { data } = await supabase.from('tenants').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    case 'owner': {
      const { data } = await supabase.from('owners').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    case 'vendor': {
      const { data } = await supabase.from('vendors').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    case 'work_order': {
      const { data } = await supabase.from('work_orders').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    case 'task': {
      const { data } = await supabase.from('tasks').select('property_id').eq('id', entityId).maybeSingle()
      if (!data?.property_id) return null
      const { data: p } = await supabase.from('properties').select('org_id').eq('id', data.property_id).maybeSingle()
      return p?.org_id ?? null
    }
    case 'task_history': {
      const { data } = await supabase.from('task_history').select('task_id').eq('id', entityId).maybeSingle()
      if (!data?.task_id) return null
      const { data: t } = await supabase.from('tasks').select('property_id').eq('id', data.task_id).maybeSingle()
      if (!t?.property_id) return null
      const { data: p } = await supabase.from('properties').select('org_id').eq('id', t.property_id).maybeSingle()
      return p?.org_id ?? null
    }
    case 'bill': {
      const { data } = await supabase.from('transactions').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    case 'contact': {
      const { data } = await supabase.from('contacts').select('org_id').eq('id', entityId).maybeSingle()
      return data?.org_id ?? null
    }
    default:
      return null
  }
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseAdmin()) return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 })
  const supabase = await getSupabaseServerClient()
  const admin = requireSupabaseAdmin('files upload')

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const { entityType, entityId, fileName, mimeType, base64, category, role, isPrivate } = body as {
    entityType: EntityType
    entityId: string | number
    fileName: string
    mimeType?: string
    base64: string
    category?: string | null
    role?: string | null
    isPrivate?: boolean
  }
  if (!entityType || !entityId || !fileName || !base64) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const orgId = await resolveOrgForEntity(supabase, entityType, entityId)
  if (!orgId) return NextResponse.json({ error: 'Unable to resolve org for entity' }, { status: 400 })

  // Choose bucket
  const bucket = entityType === 'lease' ? 'lease-documents' : 'files'
  // Ensure bucket exists (best-effort)
  try {
    const { data: bInfo } = await admin.storage.getBucket(bucket)
    if (!bInfo) {
      await admin.storage.createBucket(bucket, { public: false })
    }
  } catch {}

  const storageKey = `${entityType}/${entityId}/${Date.now()}-${fileName}`
  let bytes: Uint8Array
  try {
    const raw = base64.includes(',') ? base64.split(',')[1] : base64
    bytes = Buffer.from(raw, 'base64')
  } catch {
    return NextResponse.json({ error: 'Invalid base64' }, { status: 400 })
  }

  const { error: uploadErr } = await admin.storage.from(bucket).upload(storageKey, bytes, {
    contentType: mimeType || 'application/octet-stream',
    upsert: false
  })
  if (uploadErr) return NextResponse.json({ error: 'Upload failed', details: uploadErr.message }, { status: 500 })

  // Insert files row
  const now = new Date().toISOString()
  const { data: fileRow, error: fileErr } = await admin
    .from('files')
    .insert({
      org_id: orgId,
      source: 'local',
      storage_provider: 'supabase',
      bucket,
      storage_key: storageKey,
      file_name: fileName,
      mime_type: mimeType || null,
      is_private: isPrivate ?? true,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()
  if (fileErr) return NextResponse.json({ error: 'Failed to create file record', details: fileErr.message }, { status: 500 })

  // Insert link row
  const isUuid = typeof entityId === 'string' && entityId.includes('-')
  const linkPayload: any = {
    file_id: fileRow.id,
    entity_type: entityType,
    org_id: orgId,
    role: role ?? null,
    category: category ?? null,
    added_at: now
  }
  if (isUuid) linkPayload.entity_uuid = entityId
  else linkPayload.entity_int = Number(entityId)

  const { data: linkRow, error: linkErr } = await admin
    .from('file_links')
    .insert(linkPayload)
    .select('*')
    .single()
  if (linkErr) return NextResponse.json({ error: 'Failed to link file', details: linkErr.message }, { status: 500 })

  return NextResponse.json({ file: fileRow, link: linkRow }, { status: 201 })
}

