import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { requireSupabaseAdmin, hasSupabaseAdmin } from '@/lib/supabase-client'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!hasSupabaseAdmin()) return NextResponse.json({ error: 'Server missing admin key' }, { status: 500 })
  const supabase = await getSupabaseServerClient()
  const admin = requireSupabaseAdmin('files unlink')

  const body = await request.json().catch(() => null)
  const { entityType, entityId } = (body || {}) as { entityType?: string; entityId?: string | number }
  if (!entityType || entityId == null) return NextResponse.json({ error: 'Missing entityType or entityId' }, { status: 400 })

  const isUuid = typeof entityId === 'string' && entityId.includes('-')
  let query = admin.from('file_links').delete().eq('file_id', params.id).eq('entity_type', entityType)
  query = isUuid ? query.eq('entity_uuid', entityId) : query.eq('entity_int', Number(entityId))
  const { error } = await query
  if (error) return NextResponse.json({ error: 'Unlink failed', details: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

