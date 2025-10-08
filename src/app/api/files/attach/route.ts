import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireSupabaseAdmin, hasSupabaseAdmin } from '@/lib/supabase-client'

type EntityType = 'property' | 'unit' | 'lease' | 'tenant' | 'owner' | 'vendor' | 'task' | 'task_history' | 'work_order' | 'bill' | 'contact'

async function resolveOrgForEntity(supabase: any, entityType: EntityType, entityId: string | number): Promise<string | null> {
  switch (entityType) {
    case 'property': {
      const { data } = await supabase.from('properties').select('org_id').eq('id', entityId).maybeSingle();
      return data?.org_id ?? null
    }
    case 'unit': {
      const { data } = await supabase.from('units').select('property_id').eq('id', entityId).maybeSingle();
      if (!data?.property_id) return null
      const { data: p } = await supabase.from('properties').select('org_id').eq('id', data.property_id).maybeSingle();
      return p?.org_id ?? null
    }
    case 'lease': {
      const { data } = await supabase.from('lease').select('org_id, property_id').eq('id', entityId).maybeSingle();
      if (data?.org_id) return data.org_id
      if (!data?.property_id) return null
      const { data: p } = await supabase.from('properties').select('org_id').eq('id', data.property_id).maybeSingle();
      return p?.org_id ?? null
    }
    case 'tenant': {
      const { data } = await supabase.from('tenants').select('org_id').eq('id', entityId).maybeSingle();
      return data?.org_id ?? null
    }
    case 'owner': {
      const { data } = await supabase.from('owners').select('org_id').eq('id', entityId).maybeSingle();
      return data?.org_id ?? null
    }
    case 'vendor': {
      const { data } = await supabase.from('vendors').select('org_id').eq('id', entityId).maybeSingle();
      return data?.org_id ?? null
    }
    case 'work_order': {
      const { data } = await supabase.from('work_orders').select('org_id').eq('id', entityId).maybeSingle();
      return data?.org_id ?? null
    }
    case 'task': {
      const { data } = await supabase.from('tasks').select('property_id').eq('id', entityId).maybeSingle();
      if (!data?.property_id) return null
      const { data: p } = await supabase.from('properties').select('org_id').eq('id', data.property_id).maybeSingle();
      return p?.org_id ?? null
    }
    case 'task_history': {
      const { data } = await supabase.from('task_history').select('task_id').eq('id', entityId).maybeSingle();
      if (!data?.task_id) return null
      const { data: t } = await supabase.from('tasks').select('property_id').eq('id', data.task_id).maybeSingle();
      if (!t?.property_id) return null
      const { data: p } = await supabase.from('properties').select('org_id').eq('id', t.property_id).maybeSingle();
      return p?.org_id ?? null
    }
    case 'bill': {
      const { data } = await supabase.from('transactions').select('org_id').eq('id', entityId).maybeSingle();
      return data?.org_id ?? null
    }
    case 'contact': {
      const { data } = await supabase.from('contacts').select('org_id').eq('id', entityId).maybeSingle();
      return data?.org_id ?? null
    }
    default:
      return null
  }
}

export async function POST(request: NextRequest) {
  if (!hasSupabaseAdmin()) return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 })
  const supabase = await getSupabaseServerClient()
  const admin = requireSupabaseAdmin('files attach')

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  const { fileId, entityType, entityId, category, role } = body as {
    fileId: string
    entityType: EntityType
    entityId: string | number
    category?: string | null
    role?: string | null
  }
  if (!fileId || !entityType || !entityId) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

  // Access check to file via RLS
  const { data: file } = await supabase.from('files').select('org_id').eq('id', fileId).maybeSingle()
  const fileOrg = file?.org_id || null

  const entityOrg = await resolveOrgForEntity(supabase, entityType, entityId)
  if (!entityOrg) return NextResponse.json({ error: 'Unable to resolve entity org' }, { status: 400 })
  if (fileOrg && fileOrg !== entityOrg) return NextResponse.json({ error: 'File and entity belong to different orgs' }, { status: 400 })

  const isUuid = typeof entityId === 'string' && entityId.includes('-')
  const payload: any = {
    file_id: fileId,
    entity_type: entityType,
    org_id: entityOrg,
    category: category ?? null,
    role: role ?? null
  }
  if (isUuid) payload.entity_uuid = entityId
  else payload.entity_int = Number(entityId)

  const { data: link, error } = await admin.from('file_links').insert(payload).select('*').single()
  if (error) return NextResponse.json({ error: 'Attach failed', details: error.message }, { status: 500 })
  return NextResponse.json({ link }, { status: 201 })
}

