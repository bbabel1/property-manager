import { createClient } from '@supabase/supabase-js'

type SupabaseClient = ReturnType<typeof createClient<any>> | any

export type EntityType =
  | 'property' | 'unit' | 'lease' | 'tenant' | 'owner' | 'vendor'
  | 'task' | 'task_history' | 'work_order' | 'bill' | 'contact'

export interface UnifiedFileRow {
  id: string
  org_id: string
  source: string | null
  storage_provider: string | null
  bucket: string | null
  storage_key: string | null
  external_url: string | null
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  sha256: string | null
  is_private: boolean
  buildium_file_id: number | null
  buildium_entity_type: string | null
  buildium_entity_id: number | null
  buildium_href: string | null
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface FileLinkRow {
  id: string
  file_id: string
  entity_type: EntityType
  entity_uuid: string | null
  entity_int: number | null
  org_id: string
  role: string | null
  category: string | null
  sort_index: number | null
  added_by: string | null
  added_at: string
}

export interface LeaseDocumentCompat {
  // Compatibility shape for legacy lease_documents table
  id: string
  lease_id: number
  name: string
  category: string | null
  storage_path: string | null
  mime_type: string | null
  size_bytes: number | null
  is_private: boolean
  created_at: string
  updated_at: string
}

export async function listFilesForEntity(
  client: SupabaseClient,
  entity: { type: EntityType; id: string | number }
): Promise<{ files: UnifiedFileRow[]; links: FileLinkRow[] }> {
  const isUuid = typeof entity.id === 'string' && entity.id.includes('-')
  const col = isUuid ? 'entity_uuid' : 'entity_int'
  const { data: links, error: linkErr } = await client
    .from('file_links')
    .select('*')
    .eq('entity_type', entity.type)
    .eq(col, entity.id as any)
  if (linkErr) throw linkErr

  const linkList = (links || []) as FileLinkRow[]
  const ids = linkList.map((l: FileLinkRow) => l.file_id)
  if (ids.length === 0) return { files: [], links: linkList }

  const { data: files, error: fileErr } = await client
    .from('files')
    .select('*')
    .in('id', ids)
  if (fileErr) throw fileErr

  return { files: (files || []) as UnifiedFileRow[], links: linkList }
}

export async function getLeaseDocumentsCompat(
  client: SupabaseClient,
  leaseId: number
): Promise<LeaseDocumentCompat[]> {
  const { files, links } = await listFilesForEntity(client, { type: 'lease', id: leaseId })
  const byId = new Map(files.map(f => [f.id, f]))
  return links.map(l => {
    const f = byId.get(l.file_id) as UnifiedFileRow | undefined
    if (!f) return null as unknown as LeaseDocumentCompat
    return {
      id: f.id,
      lease_id: leaseId,
      name: f.file_name,
      category: l.category ?? null,
      storage_path: f.storage_key,
      mime_type: f.mime_type,
      size_bytes: f.size_bytes,
      is_private: !!f.is_private,
      created_at: f.created_at,
      updated_at: f.updated_at,
    }
  }).filter(Boolean) as LeaseDocumentCompat[]
}
