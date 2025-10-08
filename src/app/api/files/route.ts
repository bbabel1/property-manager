import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { listFilesForEntity } from '@/lib/files'

export async function GET(request: NextRequest) {
  const supabase = await getSupabaseServerClient()
  const url = new URL(request.url)
  const entityType = url.searchParams.get('entityType') as any
  const entityId = url.searchParams.get('entityId')
  if (!entityType || !entityId) return NextResponse.json({ error: 'Missing entityType or entityId' }, { status: 400 })

  const idVal = /-/.test(entityId) ? entityId : Number(entityId)
  const { files, links } = await listFilesForEntity(supabase, { type: entityType, id: idVal })
  const items = links.map(l => ({
    link: l,
    file: files.find(f => f.id === l.file_id) || null,
  }))
  return NextResponse.json({ items })
}

