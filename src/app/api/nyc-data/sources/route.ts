import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/db'

type DataSourceRow = {
  id: string
  key: string
  dataset_id: string
  title: string | null
  description: string | null
  is_enabled: boolean
}

type RawDataSourceRow = {
  id: string
  key: string
  dataset_id: string
  title: string | null
  description: string | null
  is_enabled: boolean | null
}

const formatSource = (row: RawDataSourceRow): DataSourceRow => ({
  id: row.id,
  key: row.key,
  dataset_id: row.dataset_id,
  title: row.title ?? null,
  description: row.description ?? null,
  is_enabled: row.is_enabled !== false,
})

export async function GET(_request: NextRequest) {
  try {
    await requireAuth()
    const { data, error } = await supabaseAdmin
      .from('data_sources')
      .select('id, key, dataset_id, title, description, is_enabled, updated_at')
      .is('deleted_at', null)
      .order('key', { ascending: true })

    if (error) {
      throw error
    }

    const rows = (data || []) as RawDataSourceRow[]
    return NextResponse.json({ data: rows.map(formatSource) })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to load data sources' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
    const body = await request.json()

    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const key = typeof body.key === 'string' ? body.key.trim() : ''
    const datasetId = typeof body.datasetId === 'string' ? body.datasetId.trim() : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const isEnabled = body.isEnabled !== false

    if (!key && !id) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'Key or id is required' } },
        { status: 400 }
      )
    }

    if (!datasetId) {
      return NextResponse.json(
        { error: { code: 'invalid_request', message: 'datasetId is required' } },
        { status: 400 }
      )
    }

    if (key && !/^[a-zA-Z0-9_-]+$/.test(key)) {
      return NextResponse.json(
        { error: { code: 'invalid_key', message: 'Key must use letters, numbers, hyphens, or underscores' } },
        { status: 400 }
      )
    }

    let result: DataSourceRow | null = null

    if (id) {
      const { data, error } = await supabaseAdmin
        .from('data_sources')
        .update({
          dataset_id: datasetId,
          title: title || null,
          description: description || null,
          is_enabled: isEnabled,
          deleted_at: null,
        })
        .eq('id', id)
        .select('id, key, dataset_id, title, description, is_enabled')
        .maybeSingle()

      if (error) {
        throw error
      }

      result = data ? formatSource(data as RawDataSourceRow) : null
    } else {
      const safeKey = key || crypto.randomUUID()
      const { data, error } = await supabaseAdmin
        .from('data_sources')
        .insert({
          key: safeKey,
          dataset_id: datasetId,
          title: title || null,
          description: description || null,
          is_enabled: isEnabled,
          deleted_at: null,
        })
        .select('id, key, dataset_id, title, description, is_enabled')
        .single()

      if (error) {
        throw error
      }

      result = formatSource(data as RawDataSourceRow)
    }

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to add data source' } },
      { status: 500 }
    )
  }
}
